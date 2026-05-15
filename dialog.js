const DIALOG = {
    HOME_CARD_FOLDER: 'folderDialog',
    HOME_LEVEL_SELECTION: 'levelDialog',
    STUDY: 'studyDialog',
    STUDY_NOTES: 'studyNoteDialog',
    STUDY_RESULT: 'resultDialog',
    DASHBOARD: 'dashboardDialog',
    DASHBOARD_LIST: 'listDialog',
    SETTINGS: 'settingsDialog',

    closeById: function(dlgId, { callback, timeout = 320 } = {}) {
        const dlg = document.getElementById(dlgId);
        if (!dlg) return;
        if (!dlg.open && !dlg.classList.contains('closing')) return;

        dlg.classList.add('closing');
        setTimeout(() => {
            dlg.close();
            dlg.classList.remove('closing');
            if (typeof callback === 'function') callback(dlg);
        }, timeout);
    },
    openById: function(dlgId, { callback } = {}) {
        const dlg = document.getElementById(dlgId);
        if (!dlg) return;
        dlg.classList.remove('closing');
        if (typeof callback === 'function') callback(dlg);
        dlg.showModal();
    },
}
