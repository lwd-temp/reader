/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import TextPage from './textpage.js';
import ReadPage from '../readpage.js';
import onResize from '../../../ui/util/onresize.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';
import { TouchGestureListener } from '../../../ui/util/touch.js';

/**
 * @typedef {Object} PageRender
 * @property {HTMLElement} container
 * @property {number} cursor
 * @property {number} nextCursor
 */
/**
 * @typedef {Object} PageRenderCollection
 * @property {PageRender} prev
 * @property {PageRender} current
 * @property {PageRender} next
 * @property {boolean} isLast
 * @property {boolean} isFirst
 */

export default class FlipTextPage extends TextPage {
  /**
   * @param {ReadPage} readPage
   */
  constructor(readPage) {
    super(readPage);
    this.onResize = this.onResize.bind(this);
  }
  async onActivate({ id }) {
    await super.onActivate({ id });
    /** @type {PageRenderCollection} */
    this.pages = {};
    window.requestAnimationFrame(() => {
      this.updatePages();
    });
    onResize.addListener(this.onResize);
  }
  async onInactivate() {
    await super.onInactivate();
    this.pages = null;
    onResize.removeListener(this.onResize);
  }
  createContainer() {
    const container = template.create('read_content_flip');
    this.pagesContainer = container.get('pages');

    const listener = new TouchGestureListener(this.pagesContainer, {
      yRadian: Math.PI / 5,
      minDistanceY: 60,
    });
    const wos = (f, g) => (...p) => {
      if (this.isAnythingSelected()) {
        if (g) g(...p);
      } else {
        f(...p);
      }
    };

    const cancelX = () => { this.slidePage('cancel'); };
    listener.onMoveX(wos((distance, { touch }) => {
      if (touch) this.slidePage('move', distance);
      else cancelX();
    }, cancelX));
    listener.onSlideLeft(wos(({ touch }) => {
      if (touch) this.slidePage('left');
    }, cancelX));
    listener.onSlideRight(wos(({ touch }) => {
      if (touch) this.slidePage('right');
    }, cancelX));
    listener.onCancelX(cancelX);

    const cancelY = () => { this.readPage.slideIndexPage('cancel'); };
    listener.onMoveY(wos((distance, { touch }) => {
      if (touch) this.readPage.slideIndexPage('move', distance);
      else cancelY();
    }, cancelY));
    listener.onSlideUp(wos(({ touch }) => {
      if (!touch) return;
      if (this.readPage.isIndexActive()) {
        this.readPage.slideIndexPage('hide');
      } else {
        this.readPage.showControlPage();
      }
    }, cancelY));
    listener.onSlideDown(wos(({ touch }) => {
      if (touch) this.readPage.slideIndexPage('show');
    }, cancelY));
    listener.onCancelY(cancelY);

    listener.onTouchLeft(wos(() => { this.prevPage(); }));
    listener.onTouchRight(wos(() => { this.nextPage(); }));
    listener.onTouchMiddle(wos(() => { this.readPage.showControlPage(); }));

    this.pagesContainer.addEventListener('contextmenu', event => {
      if (this.isAnythingSelected()) return;
      event.preventDefault();
      this.readPage.toggleControlPage();
    }, false);

    /** @type {HTMLButtonElement} */
    this.prevButton = container.get('prev');
    this.prevButton.title = i18n.getMessage('readPagePrevious');
    this.prevButton.addEventListener('click', () => { this.prevPage(); });
    /** @type {HTMLButtonElement} */
    this.nextButton = container.get('next');
    this.nextButton.title = i18n.getMessage('readPageNext');
    this.nextButton.addEventListener('click', () => { this.nextPage(); });

    return container.get('root');
  }
  removeContainer(container) {
    this.pagesContainer = null;
    this.prevButton = null;
    this.nextButton = null;
    container.remove();
  }
  isAnythingSelected() {
    const selection = document.getSelection();
    const container = this.pages.current.container;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (range.startContainer === range.endContainer && range.startOffset === range.endOffset) continue;
      if (!container.contains(range.startContainer)) continue;
      return true;
    }
    return false;
  }
  /**
   * @param {KeyboardEvent} event
   */
  keyboardEvents(event) {
    super.keyboardEvents(event);
    const current = this.readPage.isSubpageActived();
    if (!current) {
      if (['PageUp', 'ArrowLeft'].includes(event.code)) {
        this.prevPage();
      } else if (['PageDown', 'ArrowRight'].includes(event.code)) {
        this.nextPage();
      } else if (['ArrowUp'].includes(event.code)) {
        this.readPage.showControlPage(true);
      } else if (['ArrowDown'].includes(event.code)) {
        this.readPage.slideIndexPage('show');
      }
    }
  }
  /**
   * @param {WheelEvent} event
   */
  wheelEvents(event) {
    super.wheelEvents(event);
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.read-content-pages')) return;
    if (this.wheelBusy) return;
    const deltaY = event.deltaY;
    if (!deltaY) return;
    if (deltaY > 0) this.nextPage();
    else if (deltaY < 0) this.prevPage();
    setTimeout(() => { this.wheelBusy = false; }, 250);
    this.wheelBusy = true;
  }
  /**
   * @param {'move'|'left'|'right'|'cancel'} action
   * @param {number} offset
   */
  slidePage(action, offset) {
    if (action === 'move') {
      let move = offset;
      if (offset < 0 && this.pages.isLast) {
        move = Math.max(-100, offset / 2);
      } else if (offset > 0 && this.pages.isFirst) {
        move = Math.min(100, offset / 2);
      }
      const width = window.innerWidth;
      move = Math.max(-width, Math.min(width, move));
      this.pagesContainer.style.setProperty('--slide-x', move + 'px');
      this.pagesContainer.classList.add('read-content-pages-slide');
    } else {
      this.pagesContainer.style.setProperty('--slide-x', '0px');
      this.pagesContainer.classList.remove('read-content-pages-slide');
    }
    window.requestAnimationFrame(() => {
      if (action === 'left') this.nextPage();
      if (action === 'right') this.prevPage();
    });
  }
  slideCancel() {
    this.slidePage('cancel');
    this.readPage.slideIndexPage('cancel');
  }
  nextPage(isUserTrigger = true) {
    if (this.pages.isLast) return;
    this.disposePage(this.pages.prev);
    this.pages.prev = this.pages.current;
    this.pages.current = this.pages.next;
    this.pages.next = null;
    this.updatePages(isUserTrigger);
  }
  prevPage(isUserTrigger = true) {
    if (this.pages.isFirst) return;
    this.disposePage(this.pages.next);
    this.pages.next = this.pages.current;
    this.pages.current = this.pages.prev;
    this.pages.prev = null;
    this.updatePages(isUserTrigger);
  }
  resetPage(isUserTrigger = false) {
    this.slideCancel();
    this.stepCache = null;
    this.disposePages();
    this.pages.isLast = null;
    this.pages.isFirst = null;
    this.updatePages(isUserTrigger);
  }
  updatePages(isUserTrigger) {
    const content = this.readPage.getContent();
    const cursor = this.ignoreSpaces(Math.max(this.readPage.getCursor() || 0, 0));
    const pages = this.pages;
    // Current Page
    if (!pages.current) {
      if (cursor < content.length) {
        const current = this.layoutPageStartsWith(cursor);
        // Cursor corrupted
        if (!current) { this.setCursor(0); return; }
        this.addRenderedPage(current);
        pages.current = current;
      } else {
        const current = this.layoutPageEndsWith(content.length);
        pages.current = current;
      }
    }
    pages.current.container.className = 'read-content-page read-content-page-current';
    pages.current.container.removeAttribute('aria-hidden');
    // Active screen reader only if speech synthesis is not enabled
    const currentArticles = Array.from(pages.current.container.querySelectorAll('.read-body'));
    if (!this.readPage.isSpeaking()) {
      currentArticles.forEach(article => {
        const parent = article.parentNode;
        const placeholder = document.createElement('span');
        parent.replaceChild(placeholder, article);
        parent.replaceChild(article, placeholder);
        article.setAttribute('aria-live', 'polite');
      });
    } else {
      currentArticles.forEach(article => {
        article.removeAttribute('aria-live');
      });
    }
    // Next Page
    if (!pages.next && !pages.isLast) {
      const next = this.layoutPageStartsWith(pages.current.nextCursor);
      if (next) this.addRenderedPage(next);
      this.nextButton.disabled = !next;
      pages.isLast = !next;
      pages.next = next;
    }
    if (pages.next) {
      pages.next.container.className = 'read-content-page read-content-page-next';
      pages.next.container.setAttribute('aria-hidden', 'true');
      pages.isLast = false;
    }
    // Previous Page
    if (!pages.prev && !pages.isFirst) {
      const prev = this.layoutPageEndsWith(pages.current.cursor);
      if (prev) this.addRenderedPage(prev);
      this.prevButton.disabled = !prev;
      pages.isFirst = !prev;
      pages.prev = prev;
    }
    if (pages.prev) {
      pages.prev.container.className = 'read-content-page read-content-page-prev';
      pages.prev.container.setAttribute('aria-hidden', 'true');
      pages.isFirst = false;
    }
    if (isUserTrigger) {
      this.readPage.setCursor(this.pages.current.cursor);
    } else {
      this.readPage.updateCursor(this.pages.current.cursor);
    }
  }
  /** @param {PageRender} page */
  disposePage(page) {
    if (!page) return;
    page.container.remove();
  }
  disposePages() {
    this.disposePage(this.pages.prev);
    this.disposePage(this.pages.current);
    this.disposePage(this.pages.next);
    this.pages.prev = null;
    this.pages.current = null;
    this.pages.next = null;
  }
  /** @param {PageRender} page */
  addRenderedPage(page) {
    if (page.container.isConnected) return;
    this.pagesContainer.appendChild(page.container);
  }
  isTwoColumn() {
    if (window.innerWidth < 960) return false;
    if (window.innerWidth < 1260 && this.readPage.isSideIndexActive()) return false;
    if (window.innerWidth < window.innerHeight * 1.2) return false;
    return true;
  }
  step() {
    if (this.stepCache) return this.stepCache;
    const area = window.innerWidth * window.innerHeight;
    const textArea = (this.configs && this.configs.font_size || 18) ** 2;
    this.stepCache = Math.floor(area / textArea);
    return this.stepCache;
  }
  /**
   * @param {number} cursor
   * @param {HTMLElement} body
   * @returns {number}
   */
  layoutPageColumn(cursor, body) {
    const content = this.readPage.content;
    body.setAttribute('aria-setsize', content.length);
    body.setAttribute('aria-posinset', cursor);
    // 2. fill texts until it overflow the content
    const step = this.step();
    /** @type {HTMLParagraphElement[]} */
    const paragraphs = [];
    /** @type {HTMLParagraphElement} */
    let paragraph = null;
    let isOverflow = false;
    let after = this.ignoreSpaces(cursor);
    while (true) {
      let pos = after;
      after += step;
      const trunk = content.slice(pos, after);
      if (!trunk) break;
      trunk.split(/(\n)/).forEach(line => {
        if (!paragraph) {
          paragraph = body.appendChild(document.createElement('p'));
          paragraphs.push(paragraph);
          paragraph.dataset.start = pos;
        }
        if (line === '\n') paragraph = null;
        else paragraph.textContent += line;
        pos += line.length;
      });
      if (isOverflow) break;
      if (body.clientHeight !== body.scrollHeight) {
        isOverflow = true;
      }
      if (body.clientHeight > window.innerHeight) {
        // Maybe CSS failed to load. We should stop crazy things to prevent frozen browsers.
        break;
      }
    }
    let nextCursor;
    if (body.clientHeight !== body.scrollHeight) {
      // 3. find out where the overflow happened
      const rect = body.getBoundingClientRect();
      const firstOut = paragraphs.slice(0).reverse().find(p => {
        return p.getBoundingClientRect().top < rect.bottom;
      }) || paragraphs[0];
      const startPos = Number(firstOut.dataset.start);
      const textNode = firstOut.firstChild;
      let low, high;
      if (textNode) {
        const range = document.createRange();
        low = 0;
        high = textNode.textContent.length - 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          range.setStart(textNode, mid);
          range.setEnd(textNode, mid + 1);
          if (range.getBoundingClientRect().bottom > rect.bottom) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
      } else {
        low = 0;
        high = -1;
      }
      let targetHeight = null;
      if (high < 0) {
        targetHeight = firstOut.getBoundingClientRect().top - rect.top;
      } else {
        const range = document.createRange();
        range.setStart(textNode, low - 1);
        range.setEnd(textNode, low);
        targetHeight = range.getBoundingClientRect().bottom - rect.top;
      }
      nextCursor = startPos + low;
      // 4. Hide overflow content
      body.style.height = targetHeight + 'px';
      body.style.bottom = 'auto';
    } else {
      nextCursor = content.length;
    }
    // 5. Mark following contents hidden
    paragraphs.forEach(paragraph => {
      const start = Number(paragraph.dataset.start);
      const text = paragraph.textContent;
      const length = text.length;
      const end = start + length;
      if (start >= nextCursor) {
        paragraph.remove();
      } else if (end > nextCursor) {
        const pos = nextCursor - start;
        const before = text.slice(0, pos);
        const after = text.slice(pos);
        paragraph.textContent = before;
        const afterSpan = document.createElement('span');
        afterSpan.setAttribute('aria-hidden', 'true');
        afterSpan.textContent = after;
        paragraph.appendChild(afterSpan);
      }
    });

    return nextCursor;
  }
  /**
   * @param {number} cursor
   * @param {boolean} live
   * @returns {PageRender}
   */
  layoutPageStartsWith(cursor) {
    const content = this.readPage.getContent();
    const index = this.readPage.getIndex();
    if (this.ignoreSpaces(cursor) >= content.length) {
      return null;
    }
    const ref = template.create('readContentPage');
    const container = ref.get('root');
    const title = ref.get('title');
    const progress = ref.get('progress');
    title.textContent = this.readPage.meta.title;
    if (index && index.content && index.content.items) {
      const items = index.content.items;
      const next = items.findIndex(i => i.cursor > cursor);
      if (next === -1 && items.length) title.textContent = items[items.length - 1].title;
      else if (next > 0) title.textContent = items[next - 1].title;
    }
    progress.textContent = (cursor / content.length * 100).toFixed(2) + '%';
    container.lang = this.readPage.getLang();
    // 1. insert container into dom, so styles would applied to it
    this.pagesContainer.appendChild(container);

    let nextCursor;
    const body = ref.get('body');
    const left = ref.get('left');
    const right = ref.get('right');

    if (this.isTwoColumn()) {
      body.remove();
      const rightCursor = this.layoutPageColumn(cursor, left);
      nextCursor = this.layoutPageColumn(rightCursor, right);
    } else {
      left.remove();
      right.remove();
      nextCursor = this.layoutPageColumn(cursor, body);
    }

    // 5. Everything done
    this.pagesContainer.removeChild(container);
    container.classList.remove('read-content-page-processing');
    return { container, cursor, nextCursor };
  }
  /**
   * @param {number} nextCursor
   * @param {boolean} live
   * @returns {PageRender}
   */
  layoutPageEndsWith(nextCursor) {
    if (!nextCursor) {
      return null;
    }
    const ref = template.create('readContentPage');
    const container = ref.get('root');
    this.pagesContainer.appendChild(container);
    const step = this.step();
    const content = this.readPage.getContent();
    container.lang = this.readPage.getLang();

    const tryFill = function (nextCursor, body) {
      let low = 0, high = nextCursor;
      while (low <= high) {
        const mid = Math.max(Math.floor((low + high) / 2), high - step);
        const trunk = content.slice(mid, nextCursor).replace(/\n\s*$/, '');
        body.innerHTML = '';
        trunk.split(/\n/).forEach(line => {
          const paragraph = body.appendChild(document.createElement('p'));
          paragraph.textContent += line;
        });
        const isOverflow = body.clientHeight !== body.scrollHeight;
        if (isOverflow) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return low;
    };

    let prevCursor = null;
    const body = ref.get('body');
    const left = ref.get('left');
    const right = ref.get('right');

    if (this.isTwoColumn()) {
      body.remove();
      let leftCursor = tryFill(nextCursor, right);
      prevCursor = tryFill(leftCursor, left);
    } else {
      left.remove();
      right.remove();
      prevCursor = tryFill(nextCursor, body);
    }

    this.pagesContainer.removeChild(container);

    return this.layoutPageStartsWith(prevCursor);
  }
  clearHighlight() {
    Array.from(document.querySelectorAll('.read-highlight')).forEach(container => {
      container.innerHTML = '';
    });
    this.lastHighlightStart = null;
    this.lastHighlightLength = null;
  }
  highlightChars(start, length) {
    if (this.lastHighlightStart === start) {
      if (this.lastHighlightLength === length) {
        return null;
      }
    }
    this.clearHighlight();
    this.lastHighlightStart = start;
    this.lastHighlightLength = length;

    if (!this.pages.current) return null;

    const currentPage = this.pages.current.cursor;
    if (start < currentPage) {
      this.resetPage();
      return null;
    }

    if (this.pages.next) {
      const nextPage = this.pages.next.cursor;
      const nextNextPage = this.pages.next.nextCursor;
      if (nextPage && start >= nextPage && start <= nextNextPage) {
        this.nextPage(false);
        return null;
      }
    }

    const pageEnd = this.pages.current.nextCursor;
    if (start > pageEnd) {
      return null;
    }

    /** @type {HTMLElement} */
    const container = this.pages.current.container;
    const paragraphs = Array.from(container.querySelectorAll('p[data-start]'));
    const paragraph = paragraphs.reverse().find(p => p.dataset.start <= start);
    if (!paragraph) return false;
    const range = document.createRange();
    const paragraphStart = Number(paragraph.dataset.start);
    const node = paragraph.firstChild;
    if (!node) return false;

    const contentLength = node.textContent.length;
    const startPos = start - paragraphStart;
    if (startPos >= contentLength) {
      return startPos === contentLength;
    }
    const endPos = Math.min(startPos + length, contentLength);
    range.setStart(node, startPos);
    range.setEnd(node, endPos);
    const rects = Array.from(range.getClientRects());
    const highlight = container.querySelector('.read-highlight');
    const containerRect = container.getBoundingClientRect();
    const configs = this.configs;
    const lineHeight = Number.parseFloat(configs.font_size) *
      Number.parseFloat(configs.line_height);
    const highlightSpanList = rects.map(rect => {
      if (rect.top > window.innerHeight) return null;
      if (rect.left > window.innerWidth) return null;
      const span = document.createElement('span');
      span.style.left = (rect.left - containerRect.left) + 'px';
      span.style.width = rect.width + 'px';
      const top = rect.top - containerRect.top;
      if (rect.height <= lineHeight) {
        span.style.top = top + 'px';
        span.style.height = rect.height + 'px';
      } else {
        span.style.top = (top + (rect.height - lineHeight) / 2) + 'px';
        span.style.height = lineHeight + 'px';
      }
      highlight.appendChild(span);
      return span;
    });
    return highlightSpanList.filter(x => x != null).length > 0;
  }
  forceUpdate() {
    this.resetPage();
  }
  isInPage(cursor) {
    if (cursor < this.pages.current.cursor) return false;
    if (!this.pages.next) return false;
    if (cursor >= this.pages.next.cursor) return false;
    return true;
  }
  cursorChange(cursor) {
    const current = this.pages.current;
    if (!current || current.cursor !== cursor) {
      this.resetPage();
    }
  }
  onResize() {
    this.resetPage();
  }
}