(function () {
  'use strict';

  var I18N = {
    kk: {
      sub: function (g) { return g + ' сынып · күн есебі'; },
      day: function (d, t) { return d + '-күн / ' + t; },
      nameLabel: 'Баланың аты-жөні',
      namePh: 'Мысалы: Әли Серік',
      gradeLabel: 'Сынып',
      ansLabel: 'Жауап',
      ansPh: 'Санды жазыңыз',
      send: 'Жіберу',
      eName: 'Баланың аты мен тегін жазыңыз. Мысалы: Әли Серік',
      eGrade: 'Сыныпты таңдаңыз.',
      eAns: 'Жауапты бір сан түрінде жазыңыз.',
      eNet: 'Байланыс қатесі. Қайталап көріңіз.',
      okT: 'Жауабыңыз қабылданды!',
      okS: 'Дұрыс жауабы ертең WhatsApp тобында жарияланады. Ертең жаңа есепті шығаруды ұмытпаңыз!',
      alreadyT: 'Бүгінгі есепке жауап берілген',
      alreadyS: function (n) { return n + ' бұл есепке жауап беріп қойған. Ертең жаңа есеп шығады!'; },
      other: 'Басқа баланың атынан жіберу',
      lateT: 'Уақыт аяқталды',
      lateS: 'Кешегі есептің уақыты (23:59) өтіп кетті. Міне, бүгінгі есеп.',
      soonT: 'Есептер жақында басталады',
      soonS: function (d) { return 'Алғашқы есеп ' + d + ' шығады.'; },
      endT: 'Барлық есептер аяқталды',
      endS: 'Қатысқаныңызға рақмет! Нәтижелер WhatsApp тобында жарияланады.',
      months: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
    },
    ru: {
      sub: function (g) { return g + ' класс · задача дня'; },
      day: function (d, t) { return 'День ' + d + ' из ' + t; },
      nameLabel: 'Имя и фамилия ребёнка',
      namePh: 'Например: Али Серик',
      gradeLabel: 'Класс',
      ansLabel: 'Ответ',
      ansPh: 'Введите число',
      send: 'Отправить',
      eName: 'Укажите имя и фамилию ребёнка. Например: Али Серик',
      eGrade: 'Выберите класс.',
      eAns: 'Введите ответ одним числом.',
      eNet: 'Ошибка соединения. Попробуйте ещё раз.',
      okT: 'Ответ принят!',
      okS: 'Правильный ответ опубликуем завтра в группе WhatsApp. Не забудьте решить завтрашнюю задачу!',
      alreadyT: 'Ответ на задачу дня уже отправлен',
      alreadyS: function (n) { return n + ' уже ответил(а) на эту задачу. Завтра будет новая!'; },
      other: 'Отправить за другого ребёнка',
      lateT: 'Время вышло',
      lateS: 'Время вчерашней задачи (до 23:59) истекло. Вот задача на сегодня.',
      soonT: 'Задачи скоро начнутся',
      soonS: function (d) { return 'Первая задача появится ' + d + '.'; },
      endT: 'Все задачи завершены',
      endS: 'Спасибо за участие! Итоги опубликуем в группе WhatsApp.',
      months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
    }
  };

  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var me = store.get('zo-me') || {};
  var S = {
    lang: store.get('zo-lang') === 'ru' ? 'ru' : 'kk',
    name: me.name || '', grade: me.grade || null,
    data: null, loadedAt: 0,
    view: 'form',          // form | ok | already
    flash: null, sentName: ''
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function t(k) { return I18N[S.lang][k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(iso) { var d = new Date(iso + 'T00:00:00Z'); return d.getUTCDate() + ' ' + t('months')[d.getUTCMonth()]; }
  function todayAlmaty() { return new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10); }

  // Сервердегі ережелермен бірдей
  function validName(n) {
    var w = String(n || '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(function (x) { return x.length >= 2; });
    return w.length >= 2;
  }
  function parseAnswer(raw) {
    var s = String(raw || '').trim();
    s = s.replace(/(\d)[\s  ]+(?=\d{3}\b)/g, '$1');
    s = s.replace(/^(-?\d{1,3})[,.](\d{3})(?!\d)(?![,.]\d)/, '$1$2');
    s = s.replace(/(\d),(\d)/g, '$1.$2');
    var nums = s.match(/-?\d+(?:\.\d+)?/g);
    return nums && nums.length === 1 ? Number(nums[0]) : null;
  }

  // Интернет үзілсе не сервер бос емес болса — өздігінен 2 рет қайталайды (0,8 с, 2 с).
  // Жауап қайталанса да қауіпсіз: база бір есепке бір жауапты ғана сақтайды.
  function api(path, body, attempt) {
    attempt = attempt || 0;
    var retry = function () {
      return new Promise(function (ok) { setTimeout(ok, attempt === 0 ? 800 : 2000); })
        .then(function () { return api(path, body, attempt + 1); });
    };
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status >= 500 && attempt < 2) return retry();
        return r.json().then(function (j) { return { status: r.status, body: j, attempt: attempt }; });
      }, function (e) { if (attempt < 2) return retry(); throw e; });
  }

  function load() {
    return api('/api/today', { name: S.name }).then(function (r) {
      if (r.status !== 200) throw new Error('bad');
      S.data = r.body;
      S.loadedAt = Date.now();
      if (S.data.answered && S.view === 'form') { S.view = 'already'; S.sentName = S.name; }
      render();
    }).catch(function () {
      if (!S.data) $('#app').innerHTML = '<div class="note off"><i>!</i><div>' + esc(t('eNet')) + '</div></div>';
    });
  }

  /* ---------- render ---------- */
  function problemHtml(p) {
    var SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    var txt = esc(p[S.lang]).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function (m) {
      return '<sup>' + m.split('').map(function (c) { return SUP.indexOf(c); }).join('') + '</sup>';
    });
    var body = '<p class="prob-text">' + txt + '</p>';
    if (p.type === 'equations') {
      body += '<div class="eqs">' + p.rows.map(function (r) {
        var last = r[2] === '?' ? '<span class="qb">?</span>' : '<span class="r">' + esc(r[2]) + '</span>';
        return '<div class="eq' + (r[2] === '?' ? ' q' : '') + '"><span>' + esc(r[0]) + '</span><span class="p">+</span><span>' + esc(r[1]) + '</span><span class="e">=</span>' + last + '</div>';
      }).join('') + '</div>';
    }
    return '<article class="prob"><div class="prob-top"><span class="chip gold">' + esc(t('day')(p.day, S.data.total)) + '</span><span class="chip">' + esc(fmtDate(p.date)) + '</span><span class="chip">' + esc(t('sub')(S.data.grades.join('–')).split(' · ')[0]) + '</span></div>' + body + '</article>';
  }

  function note(kind, icon, title, sub) {
    return '<div class="note ' + kind + '"><i>' + icon + '</i><div><b>' + esc(title) + '</b>' + esc(sub) + '</div></div>';
  }

  function render() {
    var d = S.data;
    $('#sub').textContent = t('sub')(d.grades.join('–'));
    document.title = (S.lang === 'ru' ? 'Задача дня' : 'Күн есебі') + ' · ' + d.grades.join('–') + ' · EduApp';
    var p = d.problem;
    var html = S.flash ? note('off', '⏱', S.flash[0], S.flash[1]) : '';
    if (!p) {
      html += d.today < d.first ? note('off', '⏳', t('soonT'), t('soonS')(fmtDate(d.first))) : note('ok', '✓', t('endT'), t('endS'));
      $('#app').innerHTML = html;
      return;
    }
    html += problemHtml(p);
    if (S.view === 'ok') {
      html += note('ok', '✓', t('okT'), t('okS'));
    } else if (S.view === 'already') {
      html += note('ok', '✓', t('alreadyT'), t('alreadyS')(S.sentName));
    } else {
      html += '<form class="card" id="f" novalidate autocomplete="on">' +
        '<div class="field"><label for="name">' + esc(t('nameLabel')) + '</label>' +
        '<input id="name" name="name" type="text" maxlength="80" autocomplete="name" placeholder="' + esc(t('namePh')) + '" value="' + esc(S.name) + '"></div>' +
        '<div class="field"><label id="gl">' + esc(t('gradeLabel')) + '</label><div class="grades" role="radiogroup" aria-labelledby="gl">' +
        d.grades.map(function (g) { return '<button type="button" role="radio" data-g="' + g + '" aria-checked="' + (S.grade === g) + '">' + g + '</button>'; }).join('') +
        '</div></div>' +
        '<div class="field"><label for="ans">' + esc(t('ansLabel')) + '</label>' +
        '<input id="ans" type="text" inputmode="decimal" maxlength="20" autocomplete="off" placeholder="' + esc(t('ansPh')) + '"></div>' +
        '<button class="btn btn-gold" type="submit">' + esc(t('send')) + '</button>' +
        '<p class="err" id="err" role="alert"></p></form>';
    }
    if (S.view !== 'form') html += '<button type="button" class="link" id="other">' + esc(t('other')) + '</button>';
    $('#app').innerHTML = html;

    var f = $('#f');
    if (f) {
      f.addEventListener('submit', send);
      $$('.grades button').forEach(function (b) {
        b.addEventListener('click', function () {
          S.grade = Number(b.dataset.g);
          $$('.grades button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        });
      });
      $('#name').addEventListener('input', function (e) { S.name = e.target.value; });
    }
    var o = $('#other');
    if (o) o.addEventListener('click', function () { S.view = 'form'; S.name = ''; S.grade = null; S.flash = null; render(); $('#name').focus(); });
  }

  function err(msg) {
    var e = $('#err');
    e.textContent = msg;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
  }

  function send(ev) {
    ev.preventDefault();
    var name = $('#name').value.trim().replace(/\s+/g, ' ');
    var ans = $('#ans').value.trim();
    if (!validName(name)) return err(t('eName'));
    if (!S.grade) return err(t('eGrade'));
    if (parseAnswer(ans) === null) return err(t('eAns'));
    var btn = ev.target.querySelector('.btn');
    btn.disabled = true;
    api('/api/submit', { name: name, grade: S.grade, answer: ans, problemId: S.data.problem.id })
      .then(function (r) {
        var e = r.body && r.body.error;
        if (r.status === 200 || e === 'already') {
          S.name = name;
          store.set('zo-me', { name: name, grade: S.grade });
          S.sentName = (r.body && r.body.name) || name;
          // қайталау кезінде «already» келсе — бірінші жіберу сәтті өткен деген сөз
          S.view = r.status === 200 || r.attempt > 0 ? 'ok' : 'already';
          S.flash = null;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (e === 'closed') {
          S.flash = [t('lateT'), t('lateS')];
          load();
        } else {
          btn.disabled = false;
          err(e === 'name' ? t('eName') : e === 'grade' ? t('eGrade') : e === 'answer' ? t('eAns') : t('eNet'));
        }
      })
      .catch(function () { btn.disabled = false; err(t('eNet')); });
  }

  // Бет түнімен ашық тұрса — қайта оралғанда жаңартамыз.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !S.data) return;
    if (S.data.today !== todayAlmaty() || Date.now() - S.loadedAt > 10 * 60e3) {
      if (S.data.today !== todayAlmaty()) { S.view = 'form'; S.flash = null; }
      load();
    }
  });

  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      S.lang = b.dataset.lang; store.set('zo-lang', S.lang);
      document.documentElement.lang = S.lang === 'ru' ? 'ru' : 'kk';
      $$('.lang button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var a = $('#ans'), v = a ? a.value : '';
      if (S.data) render();
      if (v && $('#ans')) $('#ans').value = v;
    });
  });
  document.documentElement.lang = S.lang === 'ru' ? 'ru' : 'kk';
  $$('.lang button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.lang === S.lang)); });
  load();
})();
