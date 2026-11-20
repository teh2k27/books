// Antigravity Minimalist Book Reader
// Clean, minimal black & white design with robust URL routing and easy text extraction

(function() {
  'use strict';

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
  const backToBooksBtn = document.getElementById('back-to-books');

  const contentTopImage = document.getElementById('content-top-image');
  const chapterContent = document.getElementById('chapter-content');

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
      // Check query string style in hash: #book=1984&chapter=1
      if (rawHash.includes('=') || rawHash.includes('&')) {
        const hashParams = new URLSearchParams(rawHash.replace(/^\?/, ''));
        if (hashParams.get('book') || hashParams.get('b')) {
          bookId = hashParams.get('book') || hashParams.get('b');
        }
        if (hashParams.get('chapter') || hashParams.get('c')) {
          chapterNum = hashParams.get('chapter') || hashParams.get('c');
        }
      } else if (rawHash.includes('/')) {
        // Path style: #1984/1 or #/1984/1
        const parts = rawHash.split('/').filter(Boolean);
        if (parts.length >= 1) bookId = parts[0];
        if (parts.length >= 2) chapterNum = parts[1];
      } else if (rawHash.includes('_')) {
        // Underscore style: #1984_1
        const parts = rawHash.split('_');
        if (parts.length >= 2) {
          bookId = parts[0];
          chapterNum = parts[1];
        } else {
          bookId = rawHash;
        }
      } else {
        // Simple book id: #1984
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
  // Below: chapter names
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
        li.textContent = chap.chapter_title 
          ? `Chapter ${chap.chapter_number}: ${chap.chapter_title}` 
          : `Chapter ${chap.chapter_number}`;

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

    // Format content cleanly into paragraphs
    chapterContent.innerHTML = '';
    chapterContent.setAttribute('data-book-id', book.id);
    chapterContent.setAttribute('data-chapter-number', chapter.chapter_number);
    chapterContent.setAttribute('data-chapter-title', chapter.chapter_title || '');

    const rawText = chapter.content || '';
    // Store pure raw text in data attribute for easy extraction
    chapterContent.setAttribute('data-raw-text', rawText);

    // Split paragraphs by standard double newline or single newline
    const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    if (paragraphs.length > 0) {
      paragraphs.forEach((pText, index) => {
        const p = document.createElement('p');
        p.textContent = pText;
        if (chapter.chapter_number === 1 && (index === 0 || index === 1)) {
          p.className = 'narration-header';
        } else if (chapter.chapter_number !== 1 && index === 0) {
          p.className = 'narration-header';
        }
        chapterContent.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent = rawText;
      chapterContent.appendChild(p);
    }

    showPage('content');
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

  // Back button handler
  if (backToBooksBtn) {
    backToBooksBtn.addEventListener('click', () => {
      window.location.hash = '';
    });
  }

  // Initialize
  renderBooksList();
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // Initial routing
  handleRoute();
})();
