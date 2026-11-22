// Antigravity Minimalist Book Reader
// Clean, minimal black & white design with robust URL routing and easy text extraction

(function() {
  'use strict';

  const COPY_ICON_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  const CHECK_ICON_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  let books = window.BOOKS_DATA || [];

  // Book lookup map for O(1) retrieval
  const bookMap = new Map();
  books.forEach(b => {
    bookMap.set(String(b.id).toLowerCase(), b);
  });

  // DOM elements
  const pageBooks = document.getElementById('page-books');
  const pageChapters = document.getElementById('page-chapters');
  const pageContent = document.getElementById('page-content');

  const booksGrid = document.getElementById('books-grid');
  
  const chaptersTopImage = document.getElementById('chapters-top-image');
  const chaptersList = document.getElementById('chapters-list');

  const contentTopImage = document.getElementById('content-top-image');
  const chapterContent = document.getElementById('chapter-content');
  const contentCopyBtn = document.getElementById('content-copy-btn');

  let activeChapterText = '';

  // Helper: Copy text to clipboard with SVG icon feedback (no text)
  function copyTextToClipboard(text, btnElement) {
    if (!text) return;
    
    function showSuccess() {
      if (btnElement) {
        btnElement.innerHTML = CHECK_ICON_SVG;
        setTimeout(() => {
          btnElement.innerHTML = COPY_ICON_SVG;
        }, 1200);
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showSuccess).catch(() => {
        fallbackCopy(text);
        showSuccess();
      });
    } else {
      fallbackCopy(text);
      showSuccess();
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(textarea);
  }

  // Helper: Find book by id or title
  function findBook(idOrTitle) {
    if (!idOrTitle) return null;
    const key = String(idOrTitle).toLowerCase().trim();
    if (bookMap.has(key)) return bookMap.get(key);
    for (const b of books) {
      if (b.title && b.title.toLowerCase() === key) return b;
    }
    return null;
  }

  // Helper: Find chapter in book
  function findChapter(book, chapIdentifier) {
    if (!book || !book.chapters || book.chapters.length === 0) return null;
    const num = parseInt(chapIdentifier, 10);
    if (!isNaN(num)) {
      const match = book.chapters.find(c => c.chapter_number === num);
      if (match) return match;
      if (num >= 1 && num <= book.chapters.length) {
        return book.chapters[num - 1];
      }
    }
    // Match by title
    const titleKey = String(chapIdentifier).toLowerCase().trim();
    return book.chapters.find(c => c.chapter_title && c.chapter_title.toLowerCase() === titleKey) || null;
  }

  // Parse current route from URL (hash and search params)
  function parseCurrentRoute() {
    let bookId = null;
    let chapterNum = null;

    // 1. Check query parameters first
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('book') || searchParams.get('b')) {
      bookId = searchParams.get('book') || searchParams.get('b');
    }
    if (searchParams.get('chapter') || searchParams.get('c')) {
      chapterNum = searchParams.get('chapter') || searchParams.get('c');
    }

    // 2. Hash parameters take precedence or supplement
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (rawHash) {
      if (rawHash.includes('=') || rawHash.includes('&')) {
        const hashParams = new URLSearchParams(rawHash.replace(/^\?/, ''));
        if (hashParams.get('book') || hashParams.get('b')) {
          bookId = hashParams.get('book') || hashParams.get('b');
        }
        if (hashParams.get('chapter') || hashParams.get('c')) {
          chapterNum = hashParams.get('chapter') || hashParams.get('c');
        }
      } else if (rawHash.includes('/')) {
        const parts = rawHash.split('/').filter(Boolean);
        if (parts.length >= 1) bookId = parts[0];
        if (parts.length >= 2) chapterNum = parts[1];
      } else if (rawHash.includes('_')) {
        const parts = rawHash.split('_');
        if (parts.length >= 2) {
          bookId = parts[0];
          chapterNum = parts[1];
        } else {
          bookId = rawHash;
        }
      } else {
        bookId = rawHash;
      }
    }

    return { bookId, chapterNum };
  }

  // Setup image error fallback
  function setupImageWithFallback(imgElement, book) {
    if (!imgElement || !book) return;
    const primary = book.cover_url || book.cover_external_url || book.cover_storage_url || '';
    const fallback1 = book.cover_external_url || '';
    const fallback2 = book.cover_storage_url || '';

    imgElement.src = primary;
    imgElement.alt = book.title || 'Book Cover';

    imgElement.onerror = function() {
      if (fallback1 && imgElement.src !== fallback1) {
        imgElement.src = fallback1;
      } else if (fallback2 && imgElement.src !== fallback2) {
        imgElement.src = fallback2;
      } else {
        imgElement.style.display = 'none';
      }
    };
  }

  // Navigation functions
  function showPage(pageId) {
    pageBooks.classList.remove('active');
    pageChapters.classList.remove('active');
    pageContent.classList.remove('active');

    if (pageId === 'books') pageBooks.classList.add('active');
    else if (pageId === 'chapters') pageChapters.classList.add('active');
    else if (pageId === 'content') pageContent.classList.add('active');

    window.scrollTo(0, 0);
  }

  // Render Page 1: Books List
  function renderBooksList() {
    booksGrid.innerHTML = '';
    books.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.setAttribute('data-book-id', book.id);

      const img = document.createElement('img');
      img.className = 'book-cover';
      img.loading = 'lazy';
      setupImageWithFallback(img, book);

      const title = document.createElement('div');
      title.className = 'book-name';
      title.textContent = book.title;

      card.appendChild(img);
      card.appendChild(title);

      card.addEventListener('click', () => {
        window.location.hash = `#book=${encodeURIComponent(book.id)}`;
      });

      booksGrid.appendChild(card);
    });
  }

  // Render Page 2: Book Chapters
  // Top center: book image (no name below it)
  // Below: list of chapter names with squircle copy button (no text)
  function renderBookChapters(book) {
    if (!book) {
      showPage('books');
      return;
    }

    setupImageWithFallback(chaptersTopImage, book);
    chaptersTopImage.style.display = 'block';

    // Clicking top image goes back to books list
    chaptersTopImage.onclick = () => {
      window.location.hash = '';
    };

    chaptersList.innerHTML = '';

    if (!book.chapters || book.chapters.length === 0) {
      const li = document.createElement('li');
      li.className = 'chapter-item';
      li.textContent = 'No chapters available for this book.';
      chaptersList.appendChild(li);
    } else {
      book.chapters.forEach(chap => {
        const li = document.createElement('li');
        li.className = 'chapter-item';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'chapter-item-title';
        titleSpan.textContent = chap.chapter_title 
          ? `Chapter ${chap.chapter_number} : ${chap.chapter_title}` 
          : `Chapter ${chap.chapter_number}`;

        // Squircle copy button on chapter list row (no text, only SVG)
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.type = 'button';
        copyBtn.setAttribute('aria-label', 'Copy');
        copyBtn.innerHTML = COPY_ICON_SVG;

        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          copyTextToClipboard(chap.content, copyBtn);
        });

        li.appendChild(titleSpan);
        li.appendChild(copyBtn);

        li.addEventListener('click', () => {
          window.location.hash = `#book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(chap.chapter_number)}`;
        });

        chaptersList.appendChild(li);
      });
    }

    showPage('chapters');
  }

  // Render Page 3: Chapter Content
  // Top center: book image
  // Below: only chapter content, no extra text, no header, no footer
  // Squircle copy button to copy that chapter text (no text inside)
  function renderChapterContent(book, chapter) {
    if (!book || !chapter) {
      if (book) renderBookChapters(book);
      else showPage('books');
      return;
    }

    setupImageWithFallback(contentTopImage, book);
    contentTopImage.style.display = 'block';

    // Clicking top image returns to the book chapters page
    contentTopImage.onclick = () => {
      window.location.hash = `#book=${encodeURIComponent(book.id)}`;
    };

    chapterContent.innerHTML = '';
    chapterContent.setAttribute('data-book-id', book.id);
    chapterContent.setAttribute('data-chapter-number', chapter.chapter_number);
    chapterContent.setAttribute('data-chapter-title', chapter.chapter_title || '');

    const rawText = chapter.content || '';
    activeChapterText = rawText;
    chapterContent.setAttribute('data-raw-text', rawText);

    // Format content cleanly into plain paragraphs without any classes
    const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    if (paragraphs.length > 0) {
      paragraphs.forEach(pText => {
        const p = document.createElement('p');
        p.textContent = pText;
        chapterContent.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent = rawText;
      chapterContent.appendChild(p);
    }

    showPage('content');
  }

  // Copy button handler on Chapter Content Page (Page 3)
  if (contentCopyBtn) {
    contentCopyBtn.innerHTML = COPY_ICON_SVG;
    contentCopyBtn.onclick = function() {
      copyTextToClipboard(activeChapterText, contentCopyBtn);
    };
  }

  // Route dispatcher
  function handleRoute() {
    const { bookId, chapterNum } = parseCurrentRoute();

    if (!bookId) {
      showPage('books');
      return;
    }

    const book = findBook(bookId);
    if (!book) {
      showPage('books');
      return;
    }

    if (chapterNum !== null && chapterNum !== undefined && chapterNum !== '') {
      const chapter = findChapter(book, chapterNum);
      if (chapter) {
        renderChapterContent(book, chapter);
        return;
      }
    }

    renderBookChapters(book);
  }

  // Easy extraction APIs exposed on window
  window.getChapterText = function() {
    const el = document.getElementById('chapter-content');
    if (!el) return '';
    return el.getAttribute('data-raw-text') || el.innerText || '';
  };

  window.getCurrentBook = function() {
    const { bookId } = parseCurrentRoute();
    return findBook(bookId);
  };

  window.getCurrentChapter = function() {
    const { bookId, chapterNum } = parseCurrentRoute();
    const book = findBook(bookId);
    return findChapter(book, chapterNum);
  };

  // Initialize
  renderBooksList();
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // Initial routing
  handleRoute();
})();
