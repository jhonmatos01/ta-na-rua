import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { user, setSession, setUser, refresh, api } from './api.js';
import { accountView } from './account.js';
import { managementView } from './management.js';
import { loadEvaluation, evaluationHtml, bindEvaluation } from './evaluations.js';
const app = document.querySelector('#app');
let municipalities = [],
  categoryChoices = [],
  catalogLoaded = false;
let categoryFilter = '',
  neighborhoodFilter = '',
  neighborhoodChoices = [];
const canModerate = () => ['ADMIN', 'MODERATOR'].includes(user?.role);
const statuses = {
  PENDING_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicada',
  FORWARDED: 'Encaminhada',
  ACKNOWLEDGED: 'Recebida',
  UNDER_ANALYSIS: 'Em análise',
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvida',
  CONTESTED: 'Contestada',
  CLOSED: 'Encerrada',
  REJECTED: 'Rejeitada',
  DUPLICATE: 'Duplicada',
};
let page = 1,
  filter = '',
  city = '',
  search = '',
  view = 'explore',
  selected = null,
  generation = 0;
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const date = (value) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');
const operational = () => user && user.role !== 'CITIZEN';
const options = (items, current = '') =>
  items
    .map(
      ([value, label]) =>
        `<option value="${escape(value)}" ${value === current ? 'selected' : ''}>${escape(label)}</option>`,
    )
    .join('');
function notice(message) {
  const box = document.querySelector('#notice');
  box.textContent = message;
  box.hidden = false;
}
function shell() {
  document.body.classList.toggle('management', view === 'dashboard');
  app.innerHTML = `<aside class="sidebar"><a href="#explore" class="brand"><img class="brand-logo" src="/logo.svg" alt=""> <span>TÁ NA <b>RUA</b><small>Gestão Urbana</small></span></a><p class="tagline">Uma cidade melhor começa com você.</p><div class="nav-label">SUA CIDADE</div><nav><a href="#explore" data-view="explore">◉ <span>Explorar ocorrências</span></a><a href="#map" data-view="map">⌖ <span>Mapa da cidade</span></a>${user ? '<a href="#mine" data-view="mine">▤ <span>Minhas ocorrências</span></a><a href="#notifications" data-view="notifications">♧ <span>Notificações</span></a>' : ''}${operational() ? '<div class="nav-label">GESTÃO MUNICIPAL</div><a href="#dashboard" data-view="dashboard">▥ <span>Painel de gestão</span></a><a href="#departments" data-view="departments">▤ <span>Departamentos</span></a>' : ''}${canModerate() ? '<a href="#moderation" data-view="moderation">▧ <span>Revisão de imagens</span></a>' : ''}${user?.role === 'ADMIN' ? '<a href="#users" data-view="users">♙ <span>Usuários</span></a>' : ''}</nav><div class="sidebar-bottom"><div class="community-icon">✦</div><strong>Pequenas ações.<br>Grandes mudanças.</strong><p>Veja, registre e acompanhe o que acontece no seu bairro.</p><small>Tá na Rua! · Participação cidadã</small></div></aside><div class="workspace"><header><span class="location">⌖ ${escape(municipalities.find(([id]) => id === user?.municipalityId)?.[1] || 'Sua cidade')}</span><div class="header-actions">${user ? `<a class="user-name" href="#account">${escape(user.name)}</a><button class="text-button" id="logout">Sair</button>` : '<button class="text-button" id="login">Entrar</button>'}<button class="primary" id="new">＋ Registrar ocorrência</button></div></header><main><div id="notice" role="alert" hidden></div><div id="content" aria-live="polite"></div></main><footer>Juntos, cuidamos do que é de todos. <span>Dados reais da plataforma · Ambiente local</span></footer></div><nav class="mobile-nav" aria-label="Navegação principal"><a href="#explore">⌂<span>Início</span></a><a href="#map">⌖<span>Explorar</span></a><button id="mobile-new" aria-label="Registrar ocorrência">＋</button><a href="#notifications">♧<span>Notificações</span></a><button id="mobile-profile">♙<span>${user ? 'Minha conta' : 'Entrar'}</span></button></nav><dialog id="dialog"><button class="close" aria-label="Fechar">×</button><div id="modal"></div></dialog>`;
  document
    .querySelectorAll('[data-view]')
    .forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  document.querySelector('#new').onclick = () => (user ? createForm() : authForm());
  document.querySelector('#login')?.addEventListener('click', () => authForm());
  document.querySelector('#logout')?.addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      setSession(null);
      city = '';
      filter = '';
      search = '';
      categoryFilter = '';
      neighborhoodFilter = '';
      view = 'explore';
      location.hash = 'explore';
      shell();
      await render();
    } catch (error) {
      notice(error.message);
    }
  });
  document.querySelector('#mobile-new').onclick = () => (user ? createForm() : authForm());
  document.querySelector('#mobile-profile').onclick = () => {
    if (user) location.hash = 'account';
    else authForm();
  };
  document
    .querySelectorAll('.mobile-nav a')
    .forEach((a) => a.classList.toggle('active', a.hash === '#' + view));
  const dialog = document.querySelector('#dialog');
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
function modal(html) {
  document.querySelector('#modal').innerHTML = html;
  document.querySelector('#dialog').showModal();
}
function badge(status) {
  return `<span class="badge ${['RESOLVED', 'CLOSED'].includes(status) ? 'green' : status === 'PENDING_REVIEW' ? 'gray' : 'amber'}">● ${escape(statuses[status] || status)}</span>`;
}
function card(o) {
  return `<button class="occurrence-card" data-id="${escape(o.id)}"><div class="card-picture ${o.category?.name?.includes('Ilumin') ? 'lighting' : ''}">${o.images?.[0]?.url && !o.images[0].url.includes('example.test') ? `<img data-media="${escape(o.images[0].url)}" src="/image-placeholder.svg" alt="Registro de ${escape(o.title)}" loading="lazy">` : `<span>${o.category?.name?.includes('Ilumin') ? '☼' : '⌖'}</span><small>Registro da comunidade</small>`}${badge(o.status)}</div><div class="card-body"><small class="category">${escape(o.category?.name || 'Sem categoria')}</small><h3>${escape(o.title)}</h3><p>⌖ ${escape(o.neighborhood?.name || o.municipality?.name || 'Local informado')}</p><div class="card-meta"><span>♧ ${o.confirmationCount} confirmações</span><span>${date(o.createdAt)}</span></div></div></button>`;
}
async function render() {
  const run = ++generation;
  const content = document.querySelector('#content');
  content.innerHTML = '<div class="loading">Carregando dados da cidade…</div>';
  try {
    if (['departments', 'users'].includes(view)) {
      await managementView(content, view, {
        user,
        municipalities,
        escape,
        options,
        api,
        page,
        current: () => run === generation,
        reload: async (next = page) => {
          page = next;
          await render();
        },
        modal,
        submit,
        notice,
      });
      return;
    }
    if (view === 'account') {
      if (!user) throw new Error('Entre para acessar sua conta.');
      const result = await api('/users/me');
      if (run !== generation) return;
      setUser(result.data.user);
      accountView(content, {
        user,
        municipalities,
        escape,
        options,
        api,
        submit,
        notice,
        saved: async (value) => {
          setUser(value);
          city = value.role === 'CITY_OPERATOR' ? value.municipalityId || '' : '';
          shell();
          await render();
          notice('Perfil atualizado.');
        },
        passwordChanged: async () => {
          setSession(null);
          city = '';
          location.hash = 'explore';
          view = 'explore';
          shell();
          await render();
          notice('Senha alterada. Entre novamente com a nova senha.');
        },
      });
      return;
    }
    if (view === 'moderation') {
      await moderationView(content, run);
      return;
    }
    if (view === 'map') {
      await mapView(content, run);
      return;
    }
    if (view === 'dashboard') {
      if (!operational())
        throw new Error('Entre com um perfil de gestão para acessar os indicadores.');
      await dashboard(content, run);
      return;
    }
    if (view === 'notifications') {
      if (!user) throw new Error('Entre para consultar suas notificações.');
      const result = await api('/notifications');
      if (run !== generation) return;
      content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ACOMPANHE AS NOVIDADES</p><h1>Notificações</h1></div><button id="read-all" class="secondary">Marcar todas como lidas</button></div><div class="panel">${(result.data.notifications || []).map((n) => `<article class="notification"><h3>${escape(n.title)}</h3><p>${escape(n.message)}</p><small>${date(n.createdAt)} · ${n.readAt ? 'Lida' : 'Não lida'}</small></article>`).join('') || '<p>Nenhuma notificação por aqui ainda.</p>'}</div>`;
      document.querySelector('#read-all').onclick = async () => {
        try {
          await api('/notifications/read-all', { method: 'PATCH' });
          await render();
        } catch (e) {
          notice(e.message);
        }
      };
      return;
    }
    if (view === 'mine' && !user) throw new Error('Entre para acompanhar suas ocorrências.');
    const query = new URLSearchParams({ page: String(page), limit: '12' });
    if (filter) query.set('status', filter);
    if (search.trim()) query.set('q', search.trim());
    if (categoryFilter) query.set('category', categoryFilter);
    if (neighborhoodFilter) query.set('neighborhood', neighborhoodFilter);
    if (city) query.set('municipalityId', city);
    const result = await api(`/occurrences${view === 'mine' ? '/mine' : ''}?${query}`);
    if (run !== generation) return;
    const items = result.data.occurrences;
    const visible = items;
    neighborhoodChoices = city ? await getNeighborhoods(city) : [];
    if (run !== generation) return;
    content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">PARTICIPAÇÃO QUE TRANSFORMA</p><h1>${view === 'mine' ? 'Suas ações fazem diferença.' : 'De olho na rua.'}</h1><p>${view === 'mine' ? 'Acompanhe cada registro e o retorno da sua cidade.' : 'Veja o que acontece no seu bairro e ajude a transformar sua cidade.'}</p></div><div class="heading-mark" aria-hidden="true">⌖</div></div><section class="hero"><div><span class="hero-label">JUNTOS POR UMA CIDADE MELHOR</span><h2>O problema é coletivo.<br>A solução também.</h2><p>Uma foto e alguns detalhes podem ser<br>o primeiro passo para uma solução.</p><button class="light-button" id="hero-new">Registrar uma ocorrência →</button></div><div class="city-art" aria-hidden="true"><div class="sun"></div><div class="building b1"></div><div class="building b2"></div><div class="building b3"></div><div class="building b4"></div><div class="tree">♣</div><div class="street"></div><div class="pin">⌖</div></div></section><section class="listing"><div class="section-title"><h2>${view === 'mine' ? 'Meus registros' : 'Ocorrências na cidade'} <span>${result.meta.total}</span></h2><a class="view-toggle" href="#map">⌖ Mapa <span class="selected">▤ Lista</span></a></div>${filtersHtml()}<div class="cards">${visible.map(card).join('') || '<div class="empty"><h3>Nenhuma ocorrência encontrada</h3><p>Altere os filtros ou seja o primeiro a registrar um problema.</p></div>'}</div><div class="pagination"><span>Página ${page} de ${Math.max(1, result.meta.totalPages)}</span><button class="secondary" id="prev" ${page <= 1 ? 'disabled' : ''}>← Anterior</button><button class="secondary" id="next" ${page >= result.meta.totalPages ? 'disabled' : ''}>Próxima →</button></div></section>`;
    document.querySelector('#hero-new').onclick = () => (user ? createForm() : authForm());
    bindFilters();
    hydrateImages(content);
    document.querySelector('#prev').onclick = () => {
      page--;
      render();
    };
    document.querySelector('#next').onclick = () => {
      page++;
      render();
    };
    content
      .querySelectorAll('[data-id]')
      .forEach((button) => (button.onclick = () => detail(button.dataset.id)));
  } catch (error) {
    if (run === generation)
      content.innerHTML = `<div class="empty"><h2>Não foi possível carregar esta tela</h2><p>${escape(error.message)}</p><button class="secondary" id="retry">Tentar novamente</button></div>`;
    document.querySelector('#retry')?.addEventListener('click', () => render());
  }
}
async function authForm(register = false) {
  if (register && !catalogLoaded) {
    try {
      await loadCatalog();
    } catch (e) {
      notice(e.message);
      return;
    }
  }
  modal(
    `<p class="eyebrow">BEM-VINDO À SUA CIDADE</p><h2>${register ? 'Faça parte da mudança' : 'Que bom ter você aqui.'}</h2><p>${register ? 'Crie sua conta para registrar e acompanhar ocorrências.' : 'Entre para participar e acompanhar seus registros.'}</p><form id="auth-form">${register ? '<label>Nome<input name="name" required minlength="2" autocomplete="name"></label>' : ''}<label>E-mail<input type="email" name="email" required autocomplete="email"></label><label>Senha<input type="password" name="password" required ${register ? 'minlength="12"' : ''} autocomplete="${register ? 'new-password' : 'current-password'}"></label>${register ? `<label>Município<select name="municipalityId">${options(municipalities)}</select></label><small>Senha com pelo menos 12 caracteres.</small>` : ''}<p class="form-error" role="alert"></p><button class="primary" type="submit">${register ? 'Criar conta' : 'Entrar'}</button></form><button class="text-button" id="switch-auth">${register ? 'Já tenho uma conta' : 'Ainda não tenho conta'}</button>`,
  );
  document.querySelector('#switch-auth').onclick = () => authForm(!register);
  submit('#auth-form', async (form) => {
    const data = Object.fromEntries(new FormData(form));
    if (register) await api('/auth/register', { method: 'POST', body: data });
    const result = await api('/auth/login', {
      method: 'POST',
      body: { email: data.email, password: data.password },
    });
    setSession(result.data);
    if (user.role === 'CITY_OPERATOR') {
      city = user.municipalityId || '';
      neighborhoodFilter = '';
    }
    document.querySelector('#dialog').close();
    shell();
    await render();
  });
}
function submit(selector, action) {
  document.querySelector(selector).onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    form.querySelector('.form-error').textContent = '';
    try {
      await action(form);
    } catch (error) {
      form.querySelector('.form-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
async function createForm() {
  if (!catalogLoaded) {
    try {
      await loadCatalog();
    } catch (e) {
      notice(e.message);
      return;
    }
  }
  modal(
    `<p class="eyebrow">NOVA OCORRÊNCIA</p><h2>O que você viu na rua?</h2><ol class="form-steps"><li>Localizar</li><li>Fotografar</li><li>Publicar</li></ol><form id="create-form"><label>Título<input name="title" required minlength="3" maxlength="150" placeholder="Ex.: Buraco na Rua das Flores"></label><label>Descrição<textarea name="description" maxlength="2000" placeholder="Conte o que aconteceu e como isso afeta o bairro."></textarea></label><label>Município<select name="municipalityId">${options(municipalities, user.municipalityId)}</select></label><label>Categoria<select name="categoryId"><option value="">Escolha uma categoria (opcional)</option>${options(categoryChoices)}</select></label><label>Bairro<select name="neighborhoodId"><option value="">Selecione o bairro</option></select></label><label>Outro bairro (opcional)<input name="neighborhoodText" maxlength="150"></label><label>Endereço<input name="address" maxlength="500"></label><div class="field-row"><label>Latitude<input type="number" step="any" min="-90" max="90" name="latitude" required></label><label>Longitude<input type="number" step="any" min="-180" max="180" name="longitude" required></label></div><button type="button" class="secondary" id="locate">⌖ Usar minha localização</button><label>Foto do problema<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required></label><small>JPEG, PNG ou WebP · Até 8 MB. O registro ficará em revisão.</small><label class="checkbox"><input type="checkbox" name="anonymousPublication" value="true"> Publicar sem exibir meu nome</label><p class="form-error" role="alert"></p><button class="primary" type="submit">Enviar ocorrência ↗</button></form>`,
  );
  const formCity = document.querySelector('#create-form [name=municipalityId]');
  const fillNeighborhoods = async () => {
    const id = formCity.value;
    const select = document.querySelector('#create-form [name=neighborhoodId]');
    select.disabled = true;
    try {
      const choices = await getNeighborhoods(id);
      if (formCity.value === id && select.isConnected)
        select.innerHTML = '<option value="">Selecione o bairro</option>' + options(choices);
    } catch (e) {
      if (select.isConnected)
        document.querySelector('#create-form .form-error').textContent = e.message;
    } finally {
      select.disabled = false;
    }
  };
  formCity.onchange = fillNeighborhoods;
  fillNeighborhoods();
  document.querySelector('#locate').onclick = () => {
    if (!navigator.geolocation) {
      document.querySelector('.form-error').textContent =
        'Localização indisponível. Informe as coordenadas.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.querySelector('[name=latitude]').value = position.coords.latitude;
        document.querySelector('[name=longitude]').value = position.coords.longitude;
      },
      () => {
        document.querySelector('.form-error').textContent =
          'Não foi possível acessar sua localização. Informe as coordenadas manualmente.';
      },
    );
  };
  submit('#create-form', async (form) => {
    const data = new FormData(form);
    if (data.get('image').size > 8 * 1024 * 1024) throw new Error('A imagem deve ter até 8 MB.');
    for (const [key, value] of [...data.entries()]) if (value === '') data.delete(key);
    const created = await api('/occurrences', { method: 'POST', body: data });
    const state = created.data.occurrence.aiAnalysis?.state;
    document.querySelector('#dialog').close();
    view = 'mine';
    location.hash = 'mine';
    shell();
    await render();
    notice(
      state === 'NOT_CONFIGURED'
        ? 'Ocorrência recebida. A análise automática está desativada; o registro aguarda revisão humana.'
        : 'Ocorrência recebida! Acompanhe a revisão em Meus registros.',
    );
  });
}
async function detail(id) {
  try {
    const result = await api(`/occurrences/${id}`);
    selected = result.data.occurrence;
    const o = selected;
    const history = await api(`/occurrences/${id}/status-history`);
    const evaluation = await loadEvaluation(id, { api, user });
    const departments = operational()
      ? (
          await api(
            '/departments?active=true&municipalityId=' + encodeURIComponent(o.municipality.id),
          )
        ).data.departments
      : [];
    modal(
      `<p class="eyebrow">${escape(o.protocol)}</p><h2>${escape(o.title)}</h2>${badge(o.status)}<p>${escape(o.description || 'Sem descrição adicional.')}</p><div class="detail-grid"><div><small>LOCAL</small><p>${escape(o.neighborhood?.name || o.municipality?.name)}<br>${escape(o.address)}</p></div><div><small>PARTICIPAÇÃO</small><p>${o.confirmationCount} confirmações</p></div></div>${o.images
        .filter((image) => !image.url.includes('example.test'))
        .map(
          (image) =>
            `<img class="detail-image" data-media="${escape(image.url)}" src="/image-placeholder.svg" alt="Foto da ocorrência">`,
        )
        .join(
          '',
        )}<h3>Histórico da ocorrência</h3><div class="timeline">${(history.data.history || history.data.statusHistory || []).map((h) => `<article><strong>${escape(statuses[h.newStatus] || h.newStatus)}</strong><p>${escape(h.publicMessage || h.reason || 'Status atualizado')}</p><small>${date(h.createdAt)}</small></article>`).join('') || '<p>Sem atualizações disponíveis.</p>'}</div>${user?.role === 'CITIZEN' ? '<button id="confirm" class="primary">Eu também vi</button><button id="unconfirm" class="text-button">Remover minha confirmação</button>' : ''}${operational() && allowedTransitions(o.status).length ? `<details><summary>Atualizar status</summary><form id="status-form"><label>Novo status<select name="status">${options(allowedTransitions(o.status).map((status) => [status, statuses[status]]))}</select></label><label>Motivo<textarea name="reason"></textarea></label><label>Mensagem pública<textarea name="publicMessage"></textarea></label><label>Descrição da solução<textarea name="resolutionDescription"></textarea></label><label>Departamento<select name="departmentId"><option value="">Não alterar</option>${options(departments.map((d) => [d.id, d.name]))}</select></label><label>Agendamento<input type="datetime-local" name="scheduledFor"></label><label>Previsão de resolução<input type="datetime-local" name="expectedResolutionAt"></label><label>Ocorrência original, se duplicada (UUID)<input name="duplicateOfOccurrenceId"></label><p class="form-error" role="alert"></p><button class="primary" type="submit">Salvar status</button></form></details>` : ''}${evaluationHtml(evaluation, { escape, options })}<button class="secondary" id="share">Compartilhar ocorrência</button><p class="detail-error" role="alert"></p>`,
    );
    hydrateImages(document.querySelector('#modal'));
    document.querySelector('#share').onclick = async () => {
      const url = new URL(location.href);
      url.hash = 'occurrence/' + id;
      try {
        if (navigator.share) await navigator.share({ title: o.title, url: url.href });
        else {
          await navigator.clipboard.writeText(url.href);
          document.querySelector('#share').textContent = 'Link copiado';
        }
      } catch (error) {
        if (error.name !== 'AbortError')
          document.querySelector('.detail-error').textContent =
            'Não foi possível compartilhar o link.';
      }
    };
    for (const [selector, method, path] of [
      ['#confirm', 'POST', `/occurrences/${id}/confirmations`],
      ['#unconfirm', 'DELETE', `/occurrences/${id}/confirmations/me`],
    ])
      document.querySelector(selector)?.addEventListener('click', async (event) => {
        event.target.disabled = true;
        try {
          await api(path, { method });
          document.querySelector('#dialog').close();
          await render();
          notice('Confirmação atualizada.');
        } catch (e) {
          document.querySelector('.detail-error').textContent = e.message;
          event.target.disabled = false;
        }
      });
    bindEvaluation(id, evaluation, {
      api,
      submit,
      updated: async (contested) => {
        document.querySelector('#dialog').close();
        await render();
        await detail(id);
        notice(
          contested
            ? 'Avaliação registrada. A ocorrência foi contestada pelas avaliações da comunidade.'
            : 'Avaliação registrada. Obrigado por participar!',
        );
      },
    });
    if (document.querySelector('#status-form')) {
      const statusForm = document.querySelector('#status-form');
      const selector = statusForm.querySelector('[name=status]');
      const configure = () => {
        const next = selector.value;
        const rules = {
          departmentId: next === 'FORWARDED',
          expectedResolutionAt: next === 'FORWARDED',
          scheduledFor: next === 'SCHEDULED',
          resolutionDescription: next === 'RESOLVED',
          duplicateOfOccurrenceId: next === 'DUPLICATE',
        };
        for (const [name, required] of Object.entries(rules)) {
          const field = statusForm.querySelector(`[name=${name}]`);
          field.required = required;
          field.disabled = !required;
          field.closest('label').hidden = !required;
        }
        statusForm.querySelector('[name=reason]').required =
          ['REJECTED', 'DUPLICATE', 'CONTESTED'].includes(next) ||
          o.status === 'CONTESTED' ||
          (['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'].includes(o.status) &&
            [
              'PENDING_REVIEW',
              'PUBLISHED',
              'FORWARDED',
              'ACKNOWLEDGED',
              'UNDER_ANALYSIS',
              'SCHEDULED',
              'IN_PROGRESS',
            ].includes(next));
      };
      selector.onchange = configure;
      configure();
    }
    if (document.querySelector('#status-form'))
      submit('#status-form', async (form) => {
        const body = Object.fromEntries([...new FormData(form)].filter(([, v]) => v !== ''));
        for (const key of ['scheduledFor', 'expectedResolutionAt'])
          if (body[key]) body[key] = new Date(body[key]).toISOString();
        await api(`/occurrences/${id}/status`, { method: 'PATCH', body });
        document.querySelector('#dialog').close();
        await render();
      });
  } catch (error) {
    notice(error.message);
  }
}
async function dashboard(content, run) {
  const [summaryResult, categoryResult, rankingResult, heatResult, timeResult] = await Promise.all([
    api('/dashboard/summary'),
    api('/dashboard/by-category'),
    api('/dashboard/priority-ranking'),
    api('/dashboard/heatmap'),
    api('/dashboard/resolution-time'),
  ]);
  if (run !== generation) return;
  const s = summaryResult.data.summary;
  const palette = ['#ff4862', '#0866ff', '#13b8a6', '#ffbf28', '#ad7afb'];
  let angle = 0;
  const slices = categoryResult.data.categories
    .map((c, i) => {
      const start = angle;
      angle += Math.max(0, Math.min(100, c.percentage)) * 3.6;
      return `${palette[i % palette.length]} ${start}deg ${angle}deg`;
    })
    .join(',');
  const donut = `<div class="donut-layout"><div class="donut" style="background:conic-gradient(${slices || '#eaf2ff 0deg 360deg'})"><strong>${s.totalOccurrences}<small>ocorrências</small></strong></div><ul class="donut-legend">${categoryResult.data.categories.map((c, i) => `<li><i style="background:${palette[i % palette.length]}"></i><span>${escape(c.name)}</span><b>${Number(c.percentage).toFixed(0)}%</b></li>`).join('')}</ul></div>`;
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTÃO MUNICIPAL</p><h1>Uma cidade em movimento.</h1><p>Indicadores para transformar registros em soluções.</p></div><div class="dashboard-actions">${canModerate() ? '<a class="secondary" href="#moderation">Revisar imagens</a>' : ''}<button class="secondary" id="export">↓ Exportar CSV</button></div></div><div class="metrics">${[
    ['Ocorrências', s.totalOccurrences],
    ['Em aberto', s.activeOccurrences],
    ['Resolvidas', s.resolvedOccurrences],
    ['Taxa de resolução', `${Number(s.resolutionRate).toFixed(1)}%`],
  ]
    .map(
      ([label, value]) =>
        `<article><span>${label}</span><strong>${value}</strong><small>Dados do seu escopo municipal</small></article>`,
    )
    .join(
      '',
    )} </div><div class="dashboard-grid"><section class="panel"><h2>Mapa de calor das ocorrências</h2><p class="panel-caption">Concentração de chamados em células agregadas de 250 metros.</p><div id="heat-map" style="height:340px;border-radius:10px;z-index:0"></div><div class="heatmap-legend"><span>● Menor concentração</span><span>● Maior concentração</span></div></section><section class="panel"><h2>Tipos de ocorrências</h2>${donut}<h3 class="resolution-heading">Tempo médio de resolução</h3><div class="time-stat">${timeResult.data.resolutionTime.averageHours === null ? '—' : Number(timeResult.data.resolutionTime.averageHours).toFixed(1) + ' h'}</div><p class="panel-caption">${timeResult.data.resolutionTime.resolvedOccurrences} registros resolvidos no escopo municipal.</p></section></div><div class="panel"><h2>Prioridades de atenção</h2><div class="table-scroll"><table><thead><tr><th>Ocorrência</th><th>Bairro</th><th>Status</th><th>Prioridade</th></tr></thead><tbody>${rankingResult.data.occurrences.map((o) => `<tr><td><button class="table-link" data-id="${escape(o.occurrenceId)}">${escape(o.title)}</button><small>${escape(o.protocol)}</small></td><td>${escape(o.neighborhoodName || '—')}</td><td>${badge(o.status)}</td><td>${o.priorityScore}</td></tr>`).join('')}</tbody></table></div></div>`;
  const heatMap = L.map('heat-map').setView([-12.97, -38.48], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(heatMap);
  const cells = heatResult.data.cells;
  const max = Math.max(1, ...cells.map((c) => c.occurrenceCount));
  for (const c of cells) {
    L.circle([c.latitude, c.longitude], {
      radius: 125,
      color: c.occurrenceCount / max > 0.5 ? '#ff4862' : '#ffbf28',
      weight: 1,
      fillOpacity: 0.5,
    })
      .addTo(heatMap)
      .bindTooltip(`${c.occurrenceCount} ocorrência(s) nesta célula`);
  }
  if (cells.length)
    heatMap.fitBounds(
      cells.map((c) => [c.latitude, c.longitude]),
      { padding: [35, 35], maxZoom: 14 },
    );
  content
    .querySelectorAll('[data-id]')
    .forEach((button) => (button.onclick = () => detail(button.dataset.id)));
  document.querySelector('#export').onclick = async () => {
    try {
      const response = await api('/dashboard/export', { raw: true });
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ocorrencias.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notice(e.message);
    }
  };
}
window.addEventListener('hashchange', () => {
  view = [
    'explore',
    'map',
    'mine',
    'notifications',
    'dashboard',
    'moderation',
    'departments',
    'users',
    'account',
  ].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'explore';
  page = 1;
  shell();
  render().then(() => openSharedOccurrence());
});
async function start() {
  await refresh().catch(() => {});
  let catalogError = '';
  try {
    await loadCatalog();
  } catch (e) {
    catalogError = e.message;
  }
  view = [
    'explore',
    'map',
    'mine',
    'notifications',
    'dashboard',
    'moderation',
    'departments',
    'users',
    'account',
  ].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'explore';
  shell();
  await render();
  openSharedOccurrence();
  if (catalogError) notice(catalogError);
}
start();

async function mapView(content, run) {
  const query = new URLSearchParams();
  if (city) query.set('municipalityId', city);
  if (filter) query.set('status', filter);
  if (search.trim()) query.set('q', search.trim());
  if (categoryFilter) query.set('category', categoryFilter);
  if (neighborhoodFilter) query.set('neighborhood', neighborhoodFilter);
  neighborhoodChoices = city ? await getNeighborhoods(city) : [];
  const result = await api('/occurrences/map?' + query);
  if (run !== generation) return;
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">UM OLHAR SOBRE O BAIRRO</p><h1>Mapa da cidade</h1><p>Localizações públicas aproximadas para preservar a privacidade.</p></div><a class="secondary" href="#explore">Ver lista</a></div>${filtersHtml()}<div id="city-map" style="height:540px;border-radius:14px;z-index:0"></div><p class="map-note">Base cartográfica: OpenStreetMap. O mapa precisa de conexão com a internet.</p>`;
  bindFilters();
  const map = L.map('city-map').setView([-12.97, -38.48], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  const bounds = [];
  for (const point of result.data.points) {
    const button = document.createElement('button');
    button.className = 'table-link';
    button.textContent = point.title;
    button.onclick = () => detail(point.id);
    L.circleMarker([point.latitude, point.longitude], {
      radius: 10,
      color: '#0866ff',
      fillColor: point.status === 'RESOLVED' ? '#18bb73' : '#ffbf28',
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindPopup(button);
    bounds.push([point.latitude, point.longitude]);
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
}

function openSharedOccurrence() {
  const match = location.hash.match(/^#occurrence\/([a-f0-9-]{36})$/i);
  if (match) detail(match[1]);
}

async function loadCatalog() {
  const [cities, categories] = await Promise.all([
    api('/catalog/municipalities'),
    api('/catalog/categories'),
  ]);
  municipalities = cities.data.municipalities.map((c) => [c.id, c.name]);
  categoryChoices = categories.data.categories.map((c) => [c.id, c.name]);
  catalogLoaded = true;
}
async function getNeighborhoods(id) {
  return (
    await api('/catalog/neighborhoods?municipalityId=' + encodeURIComponent(id))
  ).data.neighborhoods.map((n) => [n.id, n.name]);
}
function filtersHtml() {
  const choices =
    user?.role === 'CITY_OPERATOR'
      ? municipalities.filter(([id]) => id === user.municipalityId)
      : municipalities;
  return `<div class="filters expanded"><label class="search"><span>⌕</span><input id="search" value="${escape(search)}" placeholder="Buscar ocorrências" aria-label="Buscar ocorrências"></label><select id="city" aria-label="Município"><option value="">${user?.role === 'CITY_OPERATOR' ? 'Meu município' : 'Todos os municípios'}</option>${options(choices, city)}</select><select id="status" aria-label="Status"><option value="">Todos os status</option>${options(Object.entries(statuses), filter)}</select><select id="category" aria-label="Categoria"><option value="">Todas as categorias</option>${options(categoryChoices, categoryFilter)}</select><select id="neighborhood" aria-label="Bairro" ${!city ? 'disabled' : ''}><option value="">${city ? 'Todos os bairros' : 'Escolha um município'}</option>${options(neighborhoodChoices, neighborhoodFilter)}</select></div>`;
}
function bindFilters() {
  document.querySelector('#city').onchange = (e) => {
    city = e.target.value;
    neighborhoodFilter = '';
    page = 1;
    render();
  };
  document.querySelector('#status').onchange = (e) => {
    filter = e.target.value;
    page = 1;
    render();
  };
  document.querySelector('#category').onchange = (e) => {
    categoryFilter = e.target.value;
    page = 1;
    render();
  };
  document.querySelector('#neighborhood').onchange = (e) => {
    neighborhoodFilter = e.target.value;
    page = 1;
    render();
  };
  document.querySelector('#search').onchange = (e) => {
    search = e.target.value.trim();
    page = 1;
    render();
  };
}
function hydrateImages(container) {
  container.querySelectorAll('img[data-media]').forEach(async (img) => {
    const path = img.dataset.media;
    if (!/^\/api\/v1\/media\/[a-f0-9-]{36}(?:\/original)?$/i.test(path)) return;
    try {
      const response = await api(path.slice('/api/v1'.length), { raw: true });
      const url = URL.createObjectURL(await response.blob());
      if (!img.isConnected) {
        URL.revokeObjectURL(url);
        return;
      }
      img.onload = () => URL.revokeObjectURL(url);
      img.onerror = () => {
        URL.revokeObjectURL(url);
        img.src = '/image-placeholder.svg';
      };
      img.src = url;
    } catch {
      img.src = '/image-placeholder.svg';
    }
  });
}
async function moderationView(content, run) {
  if (!canModerate()) throw new Error('Esta fila é exclusiva da moderação e administração.');
  const status = moderationStatus;
  const result = await api(
    '/moderation/images?' + new URLSearchParams({ status, page: String(page), limit: '12' }),
  );
  if (run !== generation) return;
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">CONTEÚDO DA COMUNIDADE</p><h1>Revisão de imagens</h1><p>Revise a foto antes de publicar. Toda decisão fica registrada.</p></div><select id="moderation-filter" aria-label="Estado da revisão">${options(
    [
      ['PENDING', 'Pendentes'],
      ['FLAGGED', 'Sinalizadas'],
      ['APPROVED', 'Aprovadas'],
      ['REJECTED', 'Rejeitadas'],
    ],
    status,
  )}</select></div><div class="review-grid">${
    result.data.images
      .map(
        (image) =>
          `<article class="panel review-item"><img class="review-photo" data-media="${escape(image.originalUrl)}" src="/image-placeholder.svg" alt="Original privado em revisão">${image.status === 'APPROVED' && image.sanitizationMode ? `<details><summary>Ver versão sanitizada (${image.sanitizationMode === 'BLUR' ? 'com desfoque' : 'sem desfoque'})</summary><img class="review-photo" data-media="${escape(image.url)}" src="/image-placeholder.svg" alt="Versão sanitizada da foto"></details>` : ''}<small>${escape(image.protocol)}</small><h3>${escape(image.title)}</h3><p>${escape(statuses[image.occurrenceStatus])}</p><button class="text-button review-detail" data-id="${escape(image.occurrenceId)}">Abrir ocorrência</button><form class="review-form" data-id="${escape(image.id)}" data-expected="${escape(image.status)}"><label>Decisão<select name="status">${options(
            [
              ['APPROVED', 'Aprovar'],
              ['REJECTED', 'Rejeitar'],
              ['FLAGGED', 'Solicitar revisão adicional'],
            ].filter(([value]) => value !== image.status),
          )}</select></label><label>Versão pública<select name="sanitizationMode"><option value="BLUR">Desfoque integral</option><option value="CLEAR">Sem desfoque — confira pessoas e placas</option></select></label><label>Motivo<textarea name="reason" required minlength="3" maxlength="1000"></textarea></label><small>Aprovação da foto não publica a ocorrência automaticamente. A versão pública remove metadados. O desfoque integral oculta detalhes de toda a foto; não há detecção automática de rostos. Revise pessoas, placas e conteúdo inadequado.</small><p class="form-error" role="alert"></p><button type="submit" class="primary">Registrar decisão</button></form></article>`,
      )
      .join('') ||
    '<div class="empty"><h3>Fila sem imagens neste estado</h3><p>Altere o filtro para consultar outras decisões.</p></div>'
  }</div><div class="pagination"><span>${result.data.pagination.total} imagens · Página ${page}</span><button id="review-prev" class="secondary" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button id="review-next" class="secondary" ${page >= result.data.pagination.totalPages ? 'disabled' : ''}>Próxima</button></div>`;
  hydrateImages(content);
  document.querySelector('#moderation-filter').onchange = (e) => {
    moderationStatus = e.target.value;
    page = 1;
    render();
  };
  document.querySelector('#review-prev').onclick = () => {
    page--;
    render();
  };
  document.querySelector('#review-next').onclick = () => {
    page++;
    render();
  };
  content
    .querySelectorAll('.review-detail')
    .forEach((button) => (button.onclick = () => detail(button.dataset.id)));
  content.querySelectorAll('.review-form').forEach((form) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      try {
        await api('/moderation/images/' + form.dataset.id, {
          method: 'PATCH',
          body: {
            ...Object.fromEntries(new FormData(form)),
            expectedStatus: form.dataset.expected,
          },
        });
        await render();
        notice('Decisão de imagem registrada.');
      } catch (error) {
        form.querySelector('.form-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  });
}
let moderationStatus = 'PENDING';
function allowedTransitions(current) {
  const transitions = {
    PENDING_REVIEW: ['PUBLISHED', 'REJECTED', 'DUPLICATE'],
    PUBLISHED: ['FORWARDED', 'REJECTED', 'DUPLICATE'],
    FORWARDED: ['ACKNOWLEDGED', 'UNDER_ANALYSIS'],
    ACKNOWLEDGED: ['UNDER_ANALYSIS'],
    UNDER_ANALYSIS: ['SCHEDULED', 'IN_PROGRESS', 'REJECTED'],
    SCHEDULED: ['IN_PROGRESS', 'UNDER_ANALYSIS'],
    IN_PROGRESS: ['RESOLVED', 'UNDER_ANALYSIS'],
    RESOLVED: ['CLOSED', 'CONTESTED', 'IN_PROGRESS'],
    CLOSED: ['CONTESTED'],
    CONTESTED: ['IN_PROGRESS', 'RESOLVED'],
    REJECTED: ['PENDING_REVIEW'],
    DUPLICATE: ['PENDING_REVIEW'],
  };
  return (transitions[current] || []).filter(
    (next) =>
      user?.role !== 'CITY_OPERATOR' ||
      (!['PENDING_REVIEW', 'REJECTED', 'DUPLICATE', 'CONTESTED'].includes(next) &&
        current !== 'PENDING_REVIEW'),
  );
}
