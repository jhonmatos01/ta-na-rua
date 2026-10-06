export async function loadEvaluation(id, { api, user }) {
  const [summary, mine] = await Promise.all([
    api(`/occurrences/${id}/evaluations/summary`),
    user?.role === 'CITIZEN' ? api(`/occurrences/${id}/evaluations/me`) : Promise.resolve(null),
  ]);
  return { summary: summary.data.summary, mine: mine?.data || null };
}
export function evaluationHtml({ summary, mine }, { escape, options }) {
  const average = (value) =>
    value === null ? '—' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  let html = `<section class="evaluation-summary"><h3>Avaliações do reparo</h3><p>${summary.total} avaliações · Nota média: ${average(summary.averageRating)}/5</p>${summary.total ? `<p>${summary.negativePercentage}% indicam problema não resolvido · Atendimento: ${average(summary.averageServiceQuality)}/5</p>` : '<p>Ainda não há avaliações deste atendimento.</p>'}</section>`;
  if (!mine) return html;
  const evaluation = mine.evaluation;
  if (evaluation)
    html += `<section class="my-evaluation"><h3>Sua avaliação</h3><p>Nota ${evaluation.rating}/5 · ${evaluation.problemResolved ? 'Problema resolvido' : 'Problema não resolvido'}</p>${evaluation.serviceQuality !== null ? `<p>Atendimento: ${evaluation.serviceQuality}/5</p>` : ''}${evaluation.comment ? `<p>${escape(evaluation.comment)}</p>` : ''}<small>${mine.canEdit ? 'Você pode editar até ' + new Date(mine.editDeadline).toLocaleString('pt-BR') : mine.readOnlyReason === 'EDIT_WINDOW_EXPIRED' ? 'O prazo de edição terminou.' : 'A edição está indisponível no status atual da ocorrência.'}</small></section>`;
  if (!mine.canCreate && !mine.canEdit) {
    if (!evaluation)
      html +=
        '<p>Uma nova avaliação é disponibilizada após a resolução, para quem criou, reportou ou confirmou a ocorrência.</p>';
    return html;
  }
  const scores = [
    ['5', '5 — Ótimo'],
    ['4', '4 — Bom'],
    ['3', '3 — Regular'],
    ['2', '2 — Ruim'],
    ['1', '1 — Muito ruim'],
  ];
  return (
    html +
    `<details><summary>${evaluation ? 'Editar minha avaliação' : 'Avaliar o reparo'}</summary><form id="evaluation-form"><label>Nota<select name="rating">${options(scores, String(evaluation?.rating || 5))}</select></label><label>O problema foi resolvido?<select name="problemResolved">${options(
      [
        ['true', 'Sim'],
        ['false', 'Não'],
      ],
      String(evaluation?.problemResolved ?? true),
    )}</select></label><label>Qualidade do atendimento<select name="serviceQuality">${options([['', 'Não informar'], ...scores], evaluation?.serviceQuality ? String(evaluation.serviceQuality) : '')}</select></label><label>Comentário<textarea name="comment" maxlength="1000">${escape(evaluation?.comment)}</textarea></label><small>Seu comentário é visível aos participantes relacionados à ocorrência e à gestão autorizada.</small><p class="form-error" role="alert"></p><button type="submit" class="primary">${evaluation ? 'Salvar avaliação' : 'Enviar avaliação'}</button></form></details>`
  );
}
export function bindEvaluation(id, data, { api, submit, updated }) {
  if (!document.querySelector('#evaluation-form')) return;
  submit('#evaluation-form', async (form) => {
    const values = Object.fromEntries(new FormData(form));
    const result = await api(`/occurrences/${id}/evaluations${data.mine.evaluation ? '/me' : ''}`, {
      method: data.mine.evaluation ? 'PATCH' : 'POST',
      body: {
        rating: Number(values.rating),
        problemResolved: values.problemResolved === 'true',
        serviceQuality: values.serviceQuality ? Number(values.serviceQuality) : null,
        comment: values.comment.trim() || null,
      },
    });
    await updated(result.data.occurrenceContested);
  });
}
