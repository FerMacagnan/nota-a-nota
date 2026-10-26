// Edge Function "ler-nota": recebe fotos da nota fiscal e devolve os itens em JSON.
// A chave da API do Claude fica só aqui no servidor (secret ANTHROPIC_API_KEY), nunca no app.
//
// Secrets (Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  (obrigatório)
//   EMAILS_PERMITIDOS  (opcional) e-mails separados por vírgula que podem usar a leitura
//   LIMITE_MENSAL      (opcional) leituras por pessoa por mês, padrão 40
//   MODELO             (opcional) padrão claude-sonnet-5-5
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PROMPT = (conhecidos: string) => `Você está lendo foto(s) de uma nota fiscal / cupom fiscal (NFC-e) de supermercado brasileiro. As fotos podem ser partes da mesma nota, em ordem. Extraia TODOS os itens, sem duplicar itens que aparecem em duas fotos.

Responda SOMENTE com JSON neste formato, sem texto antes ou depois:
{"data":"AAAA-MM-DD","mercado":"nome fantasia do mercado","cnpj":"","total":0.00,"desconto":0.00,"itens":[{"nomeNota":"texto exato da nota","nome":"nome legível com marca e tamanho","chave":"slug","categoria":"basicos","qtd":1,"un":"un","vUnit":0.00,"vTotal":0.00}]}

Regras:
- "nome": expanda abreviações num nome claro, mantendo marca, variedade e tamanho. Ex.: "MOL TOM FUGINI TRAD 340G" -> "Molho de tomate Fugini tradicional 340g".
- Se o produto já existe na lista abaixo, use exatamente o mesmo "nome" e "chave". Senão, "chave" = nome em minúsculas, sem acento, com hífens.
- "categoria": uma de basicos (mercearia seca, grãos, massas, molhos, enlatados, temperos, café, açúcar, óleo), hortifruti, carnes, frios (frios, laticínios, ovos), padaria (pães, biscoitos, cereais, matinais), bebidas, congelados, higiene, limpeza, pet, outros.
- "un": "kg" para itens pesados (qtd com decimais), "l" para granel em litros, senão "un".
- "vUnit" e "vTotal" em reais, números com ponto decimal. "total" = valor a pagar da nota. "desconto" = soma dos descontos (0 se não houver). Se um item tiver desconto próprio, use o vTotal já com desconto.
- Data no formato AAAA-MM-DD. Se não conseguir ler algum campo, use "" ou 0.

Produtos já cadastrados (chave | nome | categoria):
${conhecidos || "(nenhum)"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  // quem está chamando? (o token do login vem no cabeçalho Authorization)
  let chavePublica = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!chavePublica) { try { chavePublica = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? ""; } catch { /* sem chave */ } }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, chavePublica, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ erro: "Entre na sua conta de novo." }, 401);

  const permitidos = (Deno.env.get("EMAILS_PERMITIDOS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (permitidos.length && !permitidos.includes((user.email ?? "").toLowerCase())) {
    return json({ erro: "Sua conta não tem acesso à leitura por foto. Fale com quem administra o app." }, 403);
  }

  // limite mensal por pessoa
  const limite = Number(Deno.env.get("LIMITE_MENSAL") ?? 40);
  const agora = new Date();
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
  const { count } = await supabase.from("uso_leitura").select("id", { count: "exact", head: true }).gte("criado_em", inicioMes);
  if ((count ?? 0) >= limite) return json({ erro: `Você já leu ${limite} notas este mês, o limite mensal. Digite à mão ou espere o próximo mês.` }, 429);

  let body: { imagens?: { media_type: string; data: string }[]; conhecidos?: string };
  try { body = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  const imagens = (body.imagens ?? []).filter((i) => i && typeof i.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type));
  if (!imagens.length) return json({ erro: "Nenhuma foto recebida." }, 400);
  if (imagens.length > 6) return json({ erro: "Envie no máximo 6 fotos por nota." }, 400);
  const conhecidos = String(body.conhecidos ?? "").slice(0, 60000);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ erro: "Servidor sem a chave da API configurada." }, 500);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("MODELO") ?? "claude-sonnet-5-5",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          ...imagens.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
          { type: "text", text: PROMPT(conhecidos) },
        ],
      }],
    }),
  });
  if (!resp.ok) {
    console.error("anthropic", resp.status, await resp.text());
    return json({ erro: resp.status === 429 ? "Serviço de leitura ocupado. Tente de novo em 1 minuto." : "A leitura falhou no servidor. Tente de novo." }, 502);
  }
  const out = await resp.json();
  const texto: string = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
  let nota: unknown;
  try { nota = JSON.parse(texto.slice(ini, fim + 1)); } catch {
    return json({ erro: "Não consegui organizar a nota. Tente fotos mais nítidas." }, 422);
  }

  await supabase.from("uso_leitura").insert({ user_id: user.id });
  return json(nota);
});
