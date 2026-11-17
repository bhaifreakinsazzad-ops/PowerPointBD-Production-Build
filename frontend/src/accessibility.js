// Browser-only demo adapter. Nothing in this file grants production access.
APP_STATE.previewProjectsUsed = 0;
APP_STATE.shortlist = [];
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
}
function openProject(id) {
  var p = PROJECTS_SEED.find(function(item) { return item.id === id; });
  if (!p) return;
  Object.assign(APP_STATE.activeProject, {id:p.id,title:p.title,designFamily:p.designFamily,slideCount:p.slides,motionTierRequested:p.tier,state:'design_review',revisionsUsed:0,entitlementTier:null});
  APP_STATE.activeQuote = null;
  document.getElementById('btnStartProductionAfterPay').disabled = true;
  navigateScreen('preview');
}
function toggleShortlist(id) {
  var at = APP_STATE.shortlist.indexOf(id);
  if (at === -1) APP_STATE.shortlist.push(id); else APP_STATE.shortlist.splice(at,1);
  renderDashboardProjects();
}
function openDetail(title, html) {
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailContent').innerHTML = html;
  document.getElementById('detailModal').classList.remove('hidden');
  activateModal(document.getElementById('detailModal'));
}
function closeDetail() {
  document.getElementById('detailModal').classList.add('hidden');
  restoreModalFocus();
}
function openShortlist() {
  var saved = PROJECTS_SEED.filter(function(p) { return APP_STATE.shortlist.indexOf(p.id) !== -1; });
  openDetail('Your shortlist', saved.length ? saved.map(function(p) { return '<p>'+escapeHtml(p.title)+' · '+p.slides+' slides · '+p.tier+'</p>'; }).join('') : '<p>No saved projects yet. Use Save to shortlist on a project.</p>');
}
function inspectSlide(num) {
  var s = PHASE0_SLIDES.find(function(s) { return s.num === num; });
  openDetail('Sample slide '+num, '<h3>'+escapeHtml(s.title)+'</h3><p>'+escapeHtml(s.note)+'</p><p>Roles: '+s.roles.join(', ')+'</p><p>Fixed illustrative content, not generated from your prompt.</p>');
}
var lastModalFocus;
function activateModal(modal) {
  lastModalFocus = document.activeElement;
  var first = modal.querySelector('button,input,select,a');
  if(first) first.focus();
}
function restoreModalFocus() { if(lastModalFocus && lastModalFocus.isConnected) lastModalFocus.focus(); }
var originalOpenPwa = openPwaInstallModal;
openPwaInstallModal = function() { originalOpenPwa(); activateModal(document.getElementById('pwaInstallModal')); };
var originalClosePwa = closePwaInstallModal;
closePwaInstallModal = function() { originalClosePwa(); restoreModalFocus(); };
document.addEventListener('keydown', function(e) {
  var modal = Array.from(document.querySelectorAll('[role="dialog"]')).find(function(el) { return !el.classList.contains('hidden'); });
  if(!modal) return;
  if(e.key === 'Escape') { modal.classList.add('hidden'); restoreModalFocus(); }
  if(e.key !== 'Tab') return;
  var focusable = Array.from(modal.querySelectorAll('button,input,select,a,[tabindex="0"]')).filter(function(el){return !el.disabled;});
  if(!focusable.length) return;
  var first=focusable[0], last=focusable[focusable.length-1];
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
});
window.addEventListener('hashchange', function(){navigateScreen(location.hash.slice(1));});
window.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('input,select,textarea').forEach(function(el){if(!el.getAttribute('aria-label') && !document.querySelector('label[for="'+el.id+'"]') && !el.closest('label'))el.setAttribute('aria-label',el.id || el.name || 'Demo control');});
  // Registration is deliberately scoped to local prototype files only.
  if(location.protocol !== 'file:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function(){showToast('Offline support unavailable in this browser. Online demo still works.');});
});

function quoteIsExpired(q) { return !q || q.status === 'expired' || !Number.isFinite(Date.parse(q.expiresAt)) || Date.parse(q.expiresAt) <= Date.now(); }
function quoteMatchesProject(q) { var p=APP_STATE.activeProject; return q.projectId===p.id && q.tier===p.motionTierRequested && q.slideCount===p.slideCount && q.specJson.design_family===p.designFamily && (q.tier==='static' || (q.specJson.transition_id===p.transitionId && q.specJson.intensity===p.intensity)); }
window.addEventListener('DOMContentLoaded',function(){
  var report=window.PHASE0_EVIDENCE;
  var box=document.getElementById('actualEvidence');
  if(!box||!report)return;
  box.innerHTML='<table class="w-full text-left text-xs"><thead><tr><th>Experimental specimen</th><th>Generation</th><th>Validation</th><th>Package/policy subset</th><th>Desktop</th></tr></thead><tbody>'+report.results.map(function(r){return '<tr><td class="py-2">'+escapeHtml(r.filename)+'</td><td>'+r.generation_ms+' ms</td><td>'+r.validation_ms+' ms</td><td>'+(r.validation.passed?'PASS':'FAIL')+'</td><td>UNVERIFIED</td></tr>';}).join('')+'</tbody></table>';
});
