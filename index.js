// Mobile CSS Inspector for SillyTavern
// Read-only mobile-friendly element/CSS inspector.
// Tap to select an element, view computed styles, box model, and DOM path.

(function () {
    'use strict';

    const MODULE_NAME = 'mobile-css-inspector';

    let pickerActive = false;
    let pinnedElement = null; // element currently shown in the panel
    let lastHovered = null;
    let activeTab = 'styles';

    // Properties shown in the "Styles" tab, grouped for readability.
    const STYLE_GROUPS = [
        {
            title: 'Layout',
            props: ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'overflow'],
        },
        {
            title: 'Size',
            props: ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'box-sizing'],
        },
        {
            title: 'Flex / Grid',
            props: [
                'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'flex-grow',
                'flex-shrink', 'flex-basis', 'gap', 'grid-template-columns', 'grid-template-rows',
            ],
        },
        {
            title: 'Typography',
            props: [
                'font-family', 'font-size', 'font-weight', 'line-height', 'color',
                'text-align', 'letter-spacing', 'white-space', 'text-overflow',
            ],
        },
        {
            title: 'Background / Border',
            props: [
                'background-color', 'background-image', 'border', 'border-radius',
                'box-shadow', 'opacity',
            ],
        },
        {
            title: 'Transform / Transition',
            props: ['transform', 'transition', 'animation'],
        },
    ];

    function getContextSafe() {
        try {
            return SillyTavern.getContext();
        } catch (e) {
            return null;
        }
    }

    // ---------- Toggle button ----------

    // Drag-vs-tap threshold in pixels. Below this, a touch is treated as a click.
    const DRAG_THRESHOLD = 8;

    function injectToggleButton() {
        if (document.getElementById('mci-toggle-button-floating')) return;

        const $button = document.createElement('div');
        $button.id = 'mci-toggle-button-floating';
        $button.className = 'fa-solid fa-bug mci-floating-toggle';
        $button.title = 'Mobile CSS Inspector';
        $button.tabIndex = 0;

        document.body.appendChild($button);

        // Default position: center of the screen.
        positionButtonAtCenter($button);

        makeButtonDraggable($button);

        // Re-clamp into view on viewport resize/orientation change.
        window.addEventListener('resize', () => clampButtonToViewport($button));
    }

    function positionButtonAtCenter(btn) {
        const size = 48;
        const left = Math.round((window.innerWidth - size) / 2);
        const top = Math.round((window.innerHeight - size) / 2);
        btn.style.left = `${left}px`;
        btn.style.top = `${top}px`;
    }

    function clampButtonToViewport(btn) {
        const rect = btn.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top;
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;
        left = Math.min(Math.max(0, left), Math.max(0, maxLeft));
        top = Math.min(Math.max(0, top), Math.max(0, maxTop));
        btn.style.left = `${left}px`;
        btn.style.top = `${top}px`;
    }

    function makeButtonDraggable(btn) {
        let startX = 0, startY = 0;
        let originLeft = 0, originTop = 0;
        let moved = false;
        let pointerId = null;

        function onPointerDown(e) {
            // Only one active drag at a time.
            if (pointerId !== null) return;
            pointerId = e.pointerId;
            moved = false;

            const rect = btn.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            originLeft = rect.left;
            originTop = rect.top;

            btn.setPointerCapture(pointerId);
            btn.classList.add('mci-dragging');

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        }

        function onPointerMove(e) {
            if (pointerId === null || e.pointerId !== pointerId) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
                moved = true;
            }
            if (moved) {
                const rect = btn.getBoundingClientRect();
                let left = originLeft + dx;
                let top = originTop + dy;
                left = Math.min(Math.max(0, left), window.innerWidth - rect.width);
                top = Math.min(Math.max(0, top), window.innerHeight - rect.height);
                btn.style.left = `${left}px`;
                btn.style.top = `${top}px`;
            }
        }

        function onPointerUp(e) {
            if (pointerId === null || e.pointerId !== pointerId) return;
            try { btn.releasePointerCapture(pointerId); } catch (err) { /* no-op */ }
            btn.classList.remove('mci-dragging');
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);

            const wasMoved = moved;
            pointerId = null;
            moved = false;

            if (!wasMoved) {
                togglePicker();
            }
        }

        btn.addEventListener('pointerdown', onPointerDown);
    }

    function togglePicker(forceState) {
        pickerActive = typeof forceState === 'boolean' ? forceState : !pickerActive;

        const btn = document.getElementById('mci-toggle-button-floating');
        if (btn) btn.classList.toggle('active', pickerActive);

        document.body.style.cursor = pickerActive ? 'crosshair' : '';

        if (!pickerActive) {
            hideHighlight();
        }
    }

    // ---------- Highlight overlay ----------

    function ensureHighlightEl() {
        let el = document.getElementById('mci-highlight-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mci-highlight-overlay';
            document.body.appendChild(el);
        }
        return el;
    }

    function showHighlight(target) {
        const el = ensureHighlightEl();
        const rect = target.getBoundingClientRect();
        el.style.display = 'block';
        el.style.top = `${rect.top}px`;
        el.style.left = `${rect.left}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
    }

    // ---------- Element picking (tap) ----------

    function isOwnUI(el) {
        return !!(el.closest && (el.closest('#mci-panel') || el.closest('#mci-toggle-button-floating') || el.closest('#mci-highlight-overlay')));
    }

    function handlePointerDown(e) {
        if (!pickerActive) return;
        const target = e.target;
        if (isOwnUI(target)) return;

        // Prevent the tap from also triggering SillyTavern's own click handlers
        // (sending messages, opening menus, etc.) while in picker mode.
        e.preventDefault();
        e.stopPropagation();

        selectElement(target);
    }

    function selectElement(el) {
        pinnedElement = el;
        showHighlight(el);
        renderPanel();
        openPanel();
    }

    // ---------- Style extraction ----------

    function getComputedProps(el) {
        const cs = window.getComputedStyle(el);
        const result = {};
        STYLE_GROUPS.forEach((group) => {
            group.props.forEach((prop) => {
                const val = cs.getPropertyValue(prop);
                if (val !== '') result[prop] = val;
            });
        });
        return result;
    }

    function getBoxModel(el) {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
            margin: {
                top: cs.marginTop, right: cs.marginRight, bottom: cs.marginBottom, left: cs.marginLeft,
            },
            border: {
                top: cs.borderTopWidth, right: cs.borderRightWidth, bottom: cs.borderBottomWidth, left: cs.borderLeftWidth,
            },
            padding: {
                top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft,
            },
            content: {
                width: Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
                height: Math.round(el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)),
            },
            rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
        };
    }

    function getElementPath(el) {
        const path = [];
        let node = el;
        while (node && node !== document.body.parentElement && path.length < 12) {
            path.unshift(node);
            node = node.parentElement;
        }
        return path;
    }

    function describeNode(node) {
        let label = node.tagName.toLowerCase();
        if (node.id) label += `#${node.id}`;
        if (node.classList && node.classList.length) {
            label += '.' + Array.from(node.classList).slice(0, 2).join('.');
        }
        return label;
    }

    // Full CSS selector for the element: tag + id + every class, no truncation.
    function getFullSelector(node) {
        let selector = node.tagName.toLowerCase();
        if (node.id) selector += `#${node.id}`;
        if (node.classList && node.classList.length) {
            selector += '.' + Array.from(node.classList).join('.');
        }
        return selector;
    }

    // ---------- Panel rendering ----------

    function ensurePanelEl() {
        let panel = document.getElementById('mci-panel');
        if (panel) return panel;

        panel = document.createElement('div');
        panel.id = 'mci-panel';
        panel.innerHTML = `
            <div id="mci-panel-header">
                <div id="mci-panel-drag-handle"></div>
                <div id="mci-panel-title">No element selected</div>
                <div id="mci-panel-close">✕</div>
            </div>
            <div id="mci-selector-row" class="mci-copy-row" data-prop="" data-val="">
                <span id="mci-selector-text">—</span>
                <span id="mci-selector-copy-hint">tap to copy</span>
            </div>
            <div id="mci-element-path"></div>
            <div id="mci-panel-tabs">
                <div class="mci-tab-btn" data-tab="styles">Styles</div>
                <div class="mci-tab-btn" data-tab="box">Box Model</div>
                <div class="mci-tab-btn" data-tab="attrs">Attributes</div>
            </div>
            <div id="mci-search-bar" style="display:none;">
                <input id="mci-search-input" type="text" placeholder="Filter properties..." />
            </div>
            <div id="mci-panel-body"></div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#mci-panel-close').addEventListener('click', () => {
            closePanel();
        });

        panel.querySelectorAll('.mci-tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                renderPanel();
            });
        });

        panel.querySelector('#mci-search-input').addEventListener('input', () => {
            renderBody();
        });

        panel.querySelector('#mci-selector-row').addEventListener('click', () => {
            if (!pinnedElement) return;
            const row = panel.querySelector('#mci-selector-row');
            copyToClipboard(getFullSelector(pinnedElement));
            flashRow(row);
        });

        setupPanelDrag(panel);

        return panel;
    }

    // [수정 사항 1 적용] 사용자가 드래그해서 저장한 높이를 최우선으로 복원하고 위치 계산
    function positionPanel(panel) {
        // 1. 로컬 스토리지에서 저장된 높이값 불러오기
        const savedHeight = localStorage.getItem('mciPanelHeight');
        if (savedHeight) {
            panel.style.height = `${savedHeight}px`;
            panel.style.maxHeight = `${savedHeight}px`;
        }

        // 2. 사용자가 설정한 높이가 유효하면 우선 사용하고, 없으면 콘텐츠 자체 높이 사용
        const userHeight = parseFloat(panel.style.height) || parseFloat(panel.style.maxHeight);
        const actualHeight = panel.getBoundingClientRect().height;
        const finalHeight = userHeight > 0 ? userHeight : actualHeight;

        // 3. 화면 하단에 고정되도록 top 위치 계산
        const top = Math.max(0, window.innerHeight - finalHeight);
        panel.style.top = `${top}px`;

        // 콘텐츠 양이 줄어들더라도 높이를 유지하여 창이 뜨지 않게 고정
        if (userHeight > 0) {
            panel.style.height = `${finalHeight}px`;
        }
    }

    // [수정 사항 2 적용] 패널을 드래그하여 크기를 조절할 때 실시간 반영 및 마우스/터치를 뗐을 때 크기 저장
    function setupPanelDrag(panel) {
        const header = panel.querySelector('#mci-panel-header');
        let startY = 0;
        let startHeight = 0;
        let dragging = false;

        header.addEventListener('touchstart', (e) => {
            dragging = true;
            startY = e.touches[0].clientY;
            startHeight = panel.getBoundingClientRect().height;
        }, { passive: true });

        header.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const dy = startY - e.touches[0].clientY;
            const vh = window.innerHeight;
            let newHeight = startHeight + dy;
            newHeight = Math.max(80, Math.min(vh * 0.85, newHeight));
            
            panel.style.height = `${newHeight}px`; // 높이 값 명시적 지정
            panel.style.maxHeight = `${newHeight}px`;
            panel.style.top = `${Math.max(0, vh - newHeight)}px`;
        }, { passive: true });

        header.addEventListener('touchend', () => {
            dragging = false;
            // 드래그 조작이 완료되었을 때 최종 조절된 높이를 브라우저에 기록
            if (panel.style.height) {
                localStorage.setItem('mciPanelHeight', parseFloat(panel.style.height));
            }
        });
    }

    function openPanel() {
        const panel = ensurePanelEl();
        panel.classList.add('open');
        positionPanel(panel);
        requestAnimationFrame(() => positionPanel(panel));
    }

    function closePanel() {
        const panel = document.getElementById('mci-panel');
        if (panel) panel.classList.remove('open');
        pinnedElement = null;
        hideHighlight();
    }

    function renderPanel() {
        const panel = ensurePanelEl();

        panel.querySelectorAll('.mci-tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });

        const searchBar = panel.querySelector('#mci-search-bar');
        searchBar.style.display = activeTab === 'styles' ? 'block' : 'none';

        const title = panel.querySelector('#mci-panel-title');
        const pathEl = panel.querySelector('#mci-element-path');
        const selectorText = panel.querySelector('#mci-selector-text');

        if (!pinnedElement) {
            title.textContent = 'No element selected';
            pathEl.innerHTML = '';
            selectorText.textContent = '—';
            renderBody();
            if (panel.classList.contains('open')) positionPanel(panel);
            return;
        }

        title.textContent = describeNode(pinnedElement);
        selectorText.textContent = getFullSelector(pinnedElement);

        const path = getElementPath(pinnedElement);
        pathEl.innerHTML = path
            .map((node, i) => {
                const isCurrent = i === path.length - 1;
                return `<span data-idx="${i}" class="${isCurrent ? 'mci-current' : ''}">${escapeHtml(describeNode(node))}</span>`;
            })
            .join(' <span style="color:#555">›</span> ');

        pathEl.querySelectorAll('span[data-idx]').forEach((span) => {
            span.addEventListener('click', () => {
                const idx = parseInt(span.dataset.idx, 10);
                const node = path[idx];
                if (node) selectElement(node);
            });
        });

        renderBody();
        if (panel.classList.contains('open')) positionPanel(panel);
    }

    function renderBody() {
        const body = document.getElementById('mci-panel-body');
        if (!body) return;

        if (!pinnedElement) {
            body.innerHTML = '<div id="mci-no-selection">화면을 탭해서 요소를 선택하세요.</div>';
            return;
        }

        if (activeTab === 'styles') {
            body.innerHTML = renderStylesTab(pinnedElement);
            attachCopyHandlers(body);
        } else if (activeTab === 'box') {
            body.innerHTML = renderBoxModelTab(pinnedElement);
        } else if (activeTab === 'attrs') {
            body.innerHTML = renderAttrsTab(pinnedElement);
            attachCopyHandlers(body);
        }
    }

    function renderStylesTab(el) {
        const props = getComputedProps(el);
        const filterEl = document.getElementById('mci-search-input');
        const filter = filterEl ? filterEl.value.trim().toLowerCase() : '';

        let html = '';
        STYLE_GROUPS.forEach((group) => {
            const rows = group.props
                .filter((p) => props[p] !== undefined)
                .filter((p) => !filter || p.includes(filter) || String(props[p]).toLowerCase().includes(filter))
                .map((p) => rowHtml(p, props[p]));

            if (rows.length) {
                html += `<div class="mci-section-title">${escapeHtml(group.title)}</div>`;
                html += rows.join('');
            }
        });

        if (!html) {
            html = '<div id="mci-no-selection">일치하는 속성이 없습니다.</div>';
        }
        return html;
    }

    function rowHtml(prop, val) {
        return `
            <div class="mci-row mci-copy-row" data-prop="${escapeHtml(prop)}" data-val="${escapeHtml(String(val))}">
                <span class="mci-prop">${escapeHtml(prop)}</span>
                <span class="mci-val">${escapeHtml(String(val))}</span>
            </div>
        `;
    }

    function renderBoxModelTab(el) {
        const box = getBoxModel(el);
        return `
            <div class="mci-section-title">Box Model (px)</div>
            <div id="mci-box-model">
                <div class="mci-box-margin">margin ${box.margin.top}
                    <div class="mci-box-border">border ${box.border.top}
                        <div class="mci-box-padding">padding ${box.padding.top}
                            <div class="mci-box-content">${box.content.width} × ${box.content.height}</div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>${box.padding.left}</span><span>${box.padding.right}</span>
                            </div>
                        </div>
                        padding ${box.padding.bottom}
                        <div style="display:flex;justify-content:space-between;">
                            <span>${box.border.left}</span><span>${box.border.right}</span>
                        </div>
                    </div>
                    border ${box.border.bottom}
                    <div style="display:flex;justify-content:space-between;">
                        <span>${box.margin.left}</span><span>${box.margin.right}</span>
                    </div>
                </div>
                margin ${box.margin.bottom}
            </div>
            <div class="mci-section-title">Rendered Size</div>
            ${rowHtml('width (incl. border)', `${box.rect.width}px`)}
            ${rowHtml('height (incl. border)', `${box.rect.height}px`)}
        `;
    }

    function renderAttrsTab(el) {
        let html = '<div class="mci-section-title">Attributes</div>';
        if (el.attributes.length === 0) {
            html += '<div id="mci-no-selection">속성이 없습니다.</div>';
        } else {
            const priority = ['id', 'class'];
            const attrs = Array.from(el.attributes);
            attrs.sort((a, b) => {
                const ai = priority.indexOf(a.name);
                const bi = priority.indexOf(b.name);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
            });
            attrs.forEach((attr) => {
                html += rowHtml(attr.name, attr.value || '(empty)');
            });
        }
        return html;
    }

    function attachCopyHandlers(container) {
        container.querySelectorAll('.mci-copy-row').forEach((row) => {
            row.addEventListener('click', () => {
                const prop = row.dataset.prop;
                const val = row.dataset.val;
                const text = `${prop}: ${val};`;
                copyToClipboard(text);
                flashRow(row);
            });
        });
    }

    function flashRow(row) {
        const original = row.style.background;
        row.style.background = '#3a5f3a';
        setTimeout(() => { row.style.background = original; }, 200);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* no-op */ }
        document.body.removeChild(ta);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hideHighlight() {
        const el = document.getElementById('mci-highlight-overlay');
        if (el) el.style.display = 'none';
    }

    // ---------- Init ----------

    function init() {
        injectToggleButton();

        // Use capture phase so we intercept taps before SillyTavern's own handlers.
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });

        // Keep the highlight box glued to the selected element on scroll/resize,
        // since chat content scrolls a lot in SillyTavern.
        window.addEventListener('scroll', () => {
            if (pinnedElement) showHighlight(pinnedElement);
        }, { passive: true, capture: true });

        window.addEventListener('resize', () => {
            if (pinnedElement) showHighlight(pinnedElement);
            const panel = document.getElementById('mci-panel');
            if (panel && panel.classList.contains('open')) positionPanel(panel);
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 0);
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();