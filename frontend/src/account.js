export function accountView(content, helpers) {
  const { user, municipalities, escape, options, api, submit, saved, passwordChanged } = helpers;
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">SEUS DADOS</p><h1>Minha conta</h1><p>Mantenha seu perfil atualizado e cuide da segurança da sua conta.</p></div></div>${user.role !== 'CITIZEN' ? `<div class="dashboard-actions"><a class="secondary" href="#dashboard">Painel de gestão</a><a class="secondary" href="#departments">Departamentos</a>${user.role === 'ADMIN' ? '<a class="secondary" href="#users">Usuários</a>' : ''}</div>` : ''}<div class="account-grid"><section class="panel"><h2>Perfil</h2><p>${escape(user.email)}</p><form id="profile-form"><label>Nome<input name="name" required minlength="2" maxlength="150" autocomplete="name" value="${escape(user.name)}"></label><label>Telefone<input name="phone" type="tel" maxlength="24" autocomplete="tel" value="${escape(user.phone)}"></label><label>Município<select name="municipalityId" ${user.role !== 'CITIZEN' ? 'disabled' : ''}><option value="">Não informado</option>${options(municipalities, user.municipalityId)}</select></label><label>Bairro<input name="neighborhood" maxlength="150" value="${escape(user.neighborhood)}"></label><p class="form-error" role="alert"></p><button class="primary" type="submit">Salvar perfil</button></form></section><section class="panel"><h2>Alterar senha</h2><form id="password-form"><label>Senha atual<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>Nova senha<input name="newPassword" type="password" required minlength="12" autocomplete="new-password"></label><label>Repita a nova senha<input name="confirmation" type="password" required minlength="12" autocomplete="new-password"></label><small>Use pelo menos 12 caracteres. Ao alterar a senha, todas as sessões serão encerradas.</small><p class="form-error" role="alert"></p><button class="primary" type="submit">Alterar senha</button></form></section></div>`;
  submit('#profile-form', async (form) => {
    const values = Object.fromEntries(new FormData(form));
    const result = await api('/users/me', {
      method: 'PATCH',
      body: {
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        ...(user.role === 'CITIZEN' ? { municipalityId: values.municipalityId || null } : {}),
        neighborhood: values.neighborhood.trim() || null,
      },
    });
    await saved(result.data.user);
  });
  submit('#password-form', async (form) => {
    const { currentPassword, newPassword, confirmation } = Object.fromEntries(new FormData(form));
    if (newPassword !== confirmation) throw new Error('As novas senhas precisam ser iguais.');
    await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    form.reset();
    await passwordChanged();
  });
}
