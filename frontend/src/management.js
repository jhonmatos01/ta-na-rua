const roles = [
  ['CITIZEN', 'Cidadão'],
  ['CITY_OPERATOR', 'Operador municipal'],
  ['MODERATOR', 'Moderador'],
  ['ADMIN', 'Administrador'],
];
const statuses = [
  ['ACTIVE', 'Ativo'],
  ['PENDING', 'Pendente'],
  ['BLOCKED', 'Bloqueado'],
  ['DELETED', 'Excluído'],
];
const filters = {
  departments: { municipalityId: '', active: '' },
  users: { municipalityId: '', role: '', status: '' },
};
export async function managementView(content, kind, h) {
  const {
    user,
    municipalities,
    escape,
    options,
    api,
    page,
    current,
    reload,
    modal,
    submit,
    notice,
  } = h;
  if (!user || (kind === 'users' ? user.role !== 'ADMIN' : user.role === 'CITIZEN'))
    throw new Error('Seu perfil não tem acesso a esta gestão.');
  const state = filters[kind];
  const cities =
    user.role === 'CITY_OPERATOR'
      ? municipalities.filter(([id]) => id === user.municipalityId)
      : municipalities;
  const query = new URLSearchParams({
    page: String(page),
    [kind === 'users' ? 'pageSize' : 'limit']: '12',
  });
  for (const [key, value] of Object.entries(state)) if (value) query.set(key, value);
  if (user.role === 'CITY_OPERATOR') query.set('municipalityId', user.municipalityId);
  const { data } = await api(`${kind === 'users' ? '/admin/users' : '/departments'}?${query}`);
  if (!current()) return;
  const items = kind === 'users' ? data.items : data.departments;
  const total = kind === 'users' ? data.total : data.pagination.total;
  const totalPages = Math.ceil(total / 12);
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTÃO MUNICIPAL</p><h1>${kind === 'users' ? 'Usuários' : 'Departamentos'}</h1><p>${kind === 'users' ? 'Gerencie perfis e acesso à plataforma.' : 'Organize os responsáveis pelo atendimento das ocorrências.'}</p></div>${kind === 'departments' ? '<button id="department-new" class="primary">Novo departamento</button>' : ''}</div><div class="filters"><select data-filter="municipalityId" aria-label="Município da gestão" ${user.role === 'CITY_OPERATOR' ? 'disabled' : ''}><option value="">Todos os municípios</option>${options(cities, user.role === 'CITY_OPERATOR' ? user.municipalityId : state.municipalityId)}</select>${
    kind === 'users'
      ? `<select data-filter="role" aria-label="Perfil do usuário"><option value="">Todos os perfis</option>${options(roles, state.role)}</select><select data-filter="status" aria-label="Estado do usuário"><option value="">Todos os estados</option>${options(statuses, state.status)}</select>`
      : `<select data-filter="active" aria-label="Estado do departamento">${options(
          [
            ['', 'Todos os estados'],
            ['true', 'Ativos'],
            ['false', 'Inativos'],
          ],
          state.active,
        )}</select>`
  }</div><div class="panel"><div class="table-scroll"><table><thead><tr><th>Nome</th><th>Município</th><th>${kind === 'users' ? 'Perfil / Estado' : 'Estado'}</th><th>Ações</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escape(item.name)}<small>${escape(kind === 'users' ? item.email : item.description)}</small></td><td>${escape(municipalities.find(([id]) => id === item.municipalityId)?.[1] || 'Não informado')}</td><td>${kind === 'users' ? escape(roles.find(([role]) => role === item.role)?.[1]) + ' / ' + escape(statuses.find(([status]) => status === item.status)?.[1]) : item.active ? 'Ativo' : 'Inativo'}</td><td><button class="secondary manage-edit" data-id="${escape(item.id)}" ${item.status === 'DELETED' ? 'disabled' : ''}>${kind === 'users' ? 'Gerenciar acesso' : 'Editar'}</button></td></tr>`).join('') || '<tr><td colspan="4">Nenhum registro encontrado.</td></tr>'}</tbody></table></div></div><div class="pagination"><span>${total} registros · Página ${page}</span><button id="manage-prev" class="secondary" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button id="manage-next" class="secondary" ${page >= totalPages ? 'disabled' : ''}>Próxima</button></div>`;
  content.querySelectorAll('[data-filter]').forEach((field) => {
    field.onchange = () => {
      state[field.dataset.filter] = field.value;
      reload(1);
    };
  });
  content.querySelector('#manage-prev').onclick = () => reload(page - 1);
  content.querySelector('#manage-next').onclick = () => reload(page + 1);
  function departmentForm(item) {
    modal(
      `<h2>${item ? 'Editar departamento' : 'Novo departamento'}</h2><form id="department-form">${!item ? `<label>Município<select name="municipalityId" required>${options(cities, state.municipalityId || user.municipalityId || cities[0]?.[0])}</select></label>` : ''}<label>Nome<input name="name" required minlength="2" maxlength="150" value="${escape(item?.name)}"></label><label>Descrição<textarea name="description" maxlength="2000">${escape(item?.description)}</textarea></label>${
        item
          ? `<label>Estado<select name="active">${options(
              [
                ['true', 'Ativo'],
                ['false', 'Inativo'],
              ],
              String(item.active),
            )}</select></label>`
          : ''
      }<p class="form-error" role="alert"></p><button class="primary" type="submit">Salvar departamento</button></form>`,
    );
    submit('#department-form', async (form) => {
      const values = Object.fromEntries(new FormData(form));
      await api('/departments' + (item ? '/' + item.id : ''), {
        method: item ? 'PATCH' : 'POST',
        body: {
          name: values.name.trim(),
          description: values.description.trim() || null,
          ...(!item ? { municipalityId: values.municipalityId } : {}),
        },
      });
      if (item && values.active !== String(item.active))
        await api(`/departments/${item.id}/active`, {
          method: 'PATCH',
          body: { active: values.active === 'true' },
        });
      document.querySelector('#dialog').close();
      await reload();
      notice('Departamento salvo.');
    });
  }
  function accessForm(item) {
    const self = user.id === item.id;
    modal(
      `<h2>Gerenciar acesso</h2><p>${escape(item.name)} · ${escape(item.email)}</p><form id="access-form"><label>Tipo de alteração<select name="field"><option value="status">Estado da conta</option><option value="role">Perfil de acesso</option></select></label><label>Novo valor<select name="value"></select></label><p>Ao salvar, as sessões deste usuário serão revogadas. A alteração fica registrada na auditoria.</p><p class="form-error" role="alert"></p><button type="submit" class="primary">Confirmar alteração</button></form>`,
    );
    const form = document.querySelector('#access-form');
    const configure = () => {
      const field = form.elements.field.value;
      form.elements.value.innerHTML = options(
        (field === 'role' ? roles : statuses.filter(([v]) => v !== 'DELETED')).filter(
          ([v]) => !self || v === (field === 'role' ? 'ADMIN' : 'ACTIVE'),
        ),
        item[field],
      );
    };
    form.elements.field.onchange = configure;
    configure();
    submit('#access-form', async () => {
      const field = form.elements.field.value;
      if (form.elements.value.value === item[field])
        throw new Error('Escolha um valor diferente do atual.');
      await api(`/admin/users/${item.id}/${field}`, {
        method: 'PATCH',
        body: { [field]: form.elements.value.value },
      });
      document.querySelector('#dialog').close();
      await reload();
      notice('Acesso atualizado; sessões do usuário encerradas.');
    });
  }
  content.querySelector('#department-new')?.addEventListener('click', () => departmentForm());
  content.querySelectorAll('.manage-edit').forEach((button) => {
    button.onclick = () => {
      const item = items.find((entry) => entry.id === button.dataset.id);
      if (kind === 'departments') departmentForm(item);
      else accessForm(item);
    };
  });
}
