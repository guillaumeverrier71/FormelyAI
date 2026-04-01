import os
import json
import re
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-haiku-4-5-20251001"  # le moins cher
MAX_CHUNK_CHARS = 8000


def extract_text_chunks(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    chunks = []
    overlap = 300
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        last_newline = chunk.rfind("\n\n")
        if last_newline > max_chars // 2:
            chunk = chunk[:last_newline]
            end = start + last_newline
        chunks.append(chunk)
        start = end - overlap
    return chunks


def _parse_json_response(raw: str) -> dict:
    match = re.search(r"```json\s*([\s\S]*?)```", raw)
    if match:
        raw = match.group(1)
    else:
        brace_start = raw.find("{")
        brace_end = raw.rfind("}")
        if brace_start != -1 and brace_end != -1:
            raw = raw[brace_start: brace_end + 1]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # JSON tronqué : extrait uniquement les Q/R et résumés complets déjà présents
        qa = re.findall(r'\{"question"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}', raw)
        summaries = re.findall(r'\{"chapter_title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}', raw)
        return {
            "qa": [{"question": q[0], "answer": q[1]} for q in qa],
            "summaries": [{"chapter_title": s[0], "content": s[1]} for s in summaries],
        }


def generate_qa_and_summaries(text: str, subject: str) -> dict:
    chunks = extract_text_chunks(text)
    all_qa: list[dict] = []
    all_summaries: list[dict] = []

    for i, chunk in enumerate(chunks):
        chunk_label = f"(partie {i + 1}/{len(chunks)})" if len(chunks) > 1 else ""

        prompt = f"""Tu es un assistant pédagogique expert. Voici un texte de cours sur {subject} {chunk_label}.

Génère :
1. Une liste de questions/réponses pour chaque concept clé (maximum 8 Q/R, sois concis)
2. Des fiches résumées pour chaque chapitre ou section détectée

Règles :
- Les questions doivent tester la compréhension
- Les réponses doivent être claires et complètes
- Préserve les formules mathématiques en LaTeX entre $...$ (inline) ou $$...$$ (bloc)
- Si aucun chapitre n'est détectable, crée une fiche "Résumé général"

Réponds UNIQUEMENT avec un bloc JSON valide, sans texte avant ni après :
```json
{{
  "qa": [
    {{"question": "...", "answer": "..."}}
  ],
  "summaries": [
    {{"chapter_title": "...", "content": "..."}}
  ]
}}
```

Texte du cours :
{chunk}"""

        try:
            message = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text
            parsed = _parse_json_response(raw)
        except Exception as e:
            print(f"[ai_service] Erreur partie {i+1}: {e}")
            parsed = {"qa": [], "summaries": []}

        # Filtre les cartes vides ou d'erreur
        valid_qa = [
            q for q in parsed.get("qa", [])
            if q.get("question", "").strip() and q.get("answer", "").strip()
        ]
        valid_summaries = [
            s for s in parsed.get("summaries", [])
            if s.get("chapter_title", "").strip() and s.get("content", "").strip()
        ]

        all_qa.extend(valid_qa)
        all_summaries.extend(valid_summaries)

    return {"qa": all_qa, "summaries": all_summaries}
