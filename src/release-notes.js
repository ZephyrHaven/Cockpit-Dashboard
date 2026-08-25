// release-notes.js — 从 GitHub Releases 在线加载并展示最近更新。

class CockpitReleaseNotesModal extends obs.Modal {
  constructor(app, plugin, language) {
    super(app);
    this._plugin = plugin;
    this._language = language;
    this._requestGeneration = 0;
    this._closed = false;
  }

  _t(key, vars) {
    return getText(this._language, key, vars);
  }

  _openCompleteHistory() {
    try {
      if (this.app.isMobile) window.open(GITHUB_RELEASES_URL, '_blank', 'noopener');
      else require('electron').shell.openExternal(GITHUB_RELEASES_URL);
    } catch (e) {
      try { window.open(GITHUB_RELEASES_URL, '_blank', 'noopener'); }
      catch (ignored) { new obs.Notice(this._t('releases.githubError')); }
    }
  }

  _renderLoading() {
    this._controlsEl.empty();
    this._releasePanel.empty();
    const loading = this._releasePanel.createDiv({ cls:PLUGIN_ID + '-release-loading' });
    obs.setIcon(loading.createSpan({ cls:PLUGIN_ID + '-release-loading-icon' }), 'loader-circle');
    loading.createSpan({ text:this._t('releases.loading') });
  }

  _renderError() {
    this._controlsEl.empty();
    this._releasePanel.empty();
    const error = this._releasePanel.createDiv({ cls:PLUGIN_ID + '-release-error' });
    obs.setIcon(error.createSpan({ cls:PLUGIN_ID + '-release-error-icon' }), 'cloud-off');
    const copy = error.createDiv({ cls:PLUGIN_ID + '-release-error-copy' });
    copy.createDiv({ cls:PLUGIN_ID + '-release-error-title', text:this._t('releases.errorTitle') });
    copy.createDiv({ cls:PLUGIN_ID + '-release-error-hint', text:this._t('releases.errorHint') });
    const retry = error.createEl('button', { cls:PLUGIN_ID + '-release-retry', text:this._t('releases.retry'), attr:{type:'button'} });
    retry.onclick = () => this._loadReleases();
  }

  _renderRelease(release) {
    this._releasePanel.empty();
    if (!release) {
      this._releasePanel.createDiv({ cls:PLUGIN_ID + '-release-empty', text:this._t('releases.empty') });
      return;
    }
    const card = this._releasePanel.createDiv({ cls:PLUGIN_ID + '-release-card' });
    const head = card.createDiv({ cls:PLUGIN_ID + '-release-head' });
    const headMeta = head.createDiv({ cls:PLUGIN_ID + '-release-head-meta' });
    const versionLabel = 'v' + release.version + (release.prerelease ? ' · ' + this._t('releases.prerelease') : '');
    headMeta.createDiv({ cls:PLUGIN_ID + '-release-version', text:versionLabel });
    headMeta.createDiv({ cls:PLUGIN_ID + '-release-date', text:release.date });
    const versionPrefix = release.version + ' · ';
    const displayTitle = release.title.startsWith(versionPrefix) ? release.title.slice(versionPrefix.length) : release.title;
    if (displayTitle && normalizeReleaseVersion(displayTitle) !== release.version) head.createDiv({ cls:PLUGIN_ID + '-release-title', text:displayTitle });
    const body = card.createDiv({ cls:PLUGIN_ID + '-release-markdown markdown-rendered' });
    if (!release.body.trim()) {
      body.createDiv({ cls:PLUGIN_ID + '-release-body-empty', text:this._t('releases.bodyEmpty') });
      return;
    }
    Promise.resolve(obs.MarkdownRenderer.render(this.app, release.body, body, '', this))
      .catch((e) => {
        console.warn('Cockpit: render GitHub release notes failed', e);
        body.empty();
        body.createEl('pre', { text:release.body });
      });
  }

  _renderModel(model) {
    this._controlsEl.empty();
    if (!model.selected) {
      this._renderRelease(null);
      return;
    }
    const picker = this._controlsEl.createEl('label', { cls:PLUGIN_ID + '-release-picker' });
    picker.createSpan({ text:this._t('releases.versionPicker') });
    const versionSelect = picker.createEl('select', {
      cls:PLUGIN_ID + '-release-version-select',
      attr:{ 'aria-label':this._t('releases.versionPicker') }
    });
    model.releases.forEach((release) => versionSelect.createEl('option', {
      text:'v' + release.version + (release.date ? ' · ' + release.date : ''),
      attr:{ value:release.version }
    }));
    versionSelect.value = model.selected.version;
    this._onlineReleases = model.releases;
    this._renderRelease(model.selected);
    versionSelect.onchange = () => {
      const next = selectOnlineReleaseNotes(this._onlineReleases, versionSelect.value);
      this._renderRelease(next.selected);
    };
  }

  async _loadReleases() {
    const generation = ++this._requestGeneration;
    const cached = getCachedReleaseNotesModel(this._plugin._releaseNotesCache);
    if (cached) {
      this._renderModel(cached);
      return;
    }
    this._renderLoading();
    try {
      const model = await loadGitHubReleaseNotes(obs.requestUrl);
      if (this._closed || generation !== this._requestGeneration) return;
      this._plugin._releaseNotesCache = createReleaseNotesCache(model);
      this._renderModel(model);
    } catch (e) {
      if (this._closed || generation !== this._requestGeneration) return;
      console.warn('Cockpit: load GitHub release notes failed', e);
      this._renderError();
    }
  }

  onOpen() {
    const { contentEl, modalEl, titleEl } = this;
    this._closed = false;
    modalEl.addClass(PLUGIN_ID + '-release-modal');
    titleEl.setText(this._t('releases.title'));
    this._dragCleanup = makeCockpitModalDraggable(this, titleEl, this._language === 'en' ? 'Drag release notes' : '拖动最近更新窗口');
    contentEl.empty();

    const top = contentEl.createDiv({ cls:PLUGIN_ID + '-release-top' });
    const meta = top.createDiv({ cls:PLUGIN_ID + '-release-meta' });
    const manifestVersion = normalizeReleaseVersion(this._plugin.manifest?.version || '');
    meta.createDiv({ cls:PLUGIN_ID + '-release-current', text:this._t('releases.current') + ' · v' + (manifestVersion || 'unknown') });
    meta.createDiv({ cls:PLUGIN_ID + '-release-online-note', text:this._t('releases.onlineSource') });
    this._controlsEl = top.createDiv({ cls:PLUGIN_ID + '-release-controls' });
    this._releasePanel = contentEl.createDiv({ cls:PLUGIN_ID + '-release-panel', attr:{ 'aria-live':'polite' } });

    const footer = contentEl.createDiv({ cls:PLUGIN_ID + '-release-footer' });
    footer.createDiv({ cls:PLUGIN_ID + '-release-github-note', text:this._t('releases.githubHint') });
    const githubButton = footer.createEl('button', { cls:PLUGIN_ID + '-release-github', attr:{type:'button'} });
    obs.setIcon(githubButton.createSpan(), 'external-link');
    githubButton.createSpan({ text:this._t('releases.github') });
    githubButton.onclick = () => this._openCompleteHistory();

    this._loadReleases();
  }

  onClose() {
    this._closed = true;
    this._requestGeneration++;
    this._dragCleanup?.();
    this._dragCleanup = null;
    this._onlineReleases = [];
    this.contentEl.empty();
  }
}
