import urllib.request
import urllib.error
import json
import time
import os

SQL_ENDPOINT = 'https://ep-wispy-poetry-a15ybmd6.ap-southeast-1.aws.neon.tech/sql'
CONN_STR = 'postgresql://ANTIGRAVITY:npg_R4NjFAd6hJSO@ep-wispy-poetry-a15ybmd6.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

def run_sql(sql):
    payload = json.dumps({'query': sql}).encode('utf-8')
    req = urllib.request.Request(
        SQL_ENDPOINT,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Neon-Connection-String': CONN_STR
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def main():
    print("Fetching books from Neon DB (Read-Only)...")
    t0 = time.time()
    res_books = run_sql("""
        SELECT id, title, author, cover_url, cover_external_url, cover_storage_url, total_chapters, audiobook_url
        FROM edugram.books 
        ORDER BY title ASC;
    """)
    books = res_books.get('rows', [])
    print(f"Loaded {len(books)} books in {time.time()-t0:.2f}s")

    print("Fetching chapters from Neon DB (Read-Only)...")
    t0 = time.time()
    res_chaps = run_sql("""
        SELECT id, book_id, chapter_number, chapter_title, content, audio_url
        FROM edugram.chapters 
        ORDER BY book_id ASC, chapter_number ASC;
    """)
    chapters = res_chaps.get('rows', [])
    print(f"Loaded {len(chapters)} chapters in {time.time()-t0:.2f}s")

    # Group chapters by book_id
    chapters_by_book = {}
    for chap in chapters:
        bid = chap['book_id']
        if bid not in chapters_by_book:
            chapters_by_book[bid] = []
        chapters_by_book[bid].append(chap)

    # Identify books whose all chapters audiobooks have been created and saved
    removed_books = []
    retained_books = []

    for b in books:
        bid = b['id']
        book_title = b['title'].strip()
        book_author = b['author'].strip()
        book_chapters = chapters_by_book.get(bid, [])
        total_chaps = len(book_chapters)
        
        # Count chapters with audio
        chaps_with_audio = sum(
            1 for c in book_chapters 
            if c.get('audio_url') and str(c.get('audio_url')).strip() != ''
        )

        # Check if ALL chapters have audiobooks created
        all_chapters_have_audio = (total_chaps > 0 and chaps_with_audio == total_chaps)
        
        if all_chapters_have_audio:
            removed_books.append({
                'id': bid,
                'title': book_title,
                'total_chapters': total_chaps,
                'audio_chapters': chaps_with_audio
            })
        else:
            # Prepare chapters with narration intro:
            # - Chapter 1: "{Book name} by {author name}\n\nChapter 1 : {chapter name}\n\n{content}"
            # - Chapter 2+: "Chapter {chapter_number} : {chapter name}\n\n{content}"
            client_chapters = []
            for c in book_chapters:
                c_num = c['chapter_number']
                c_title = (c.get('chapter_title') or '').strip()
                raw_body = (c.get('content') or '').strip()

                header_lines = []
                if c_num == 1:
                    header_lines.append(f"{book_title} by {book_author}")
                
                if c_title:
                    header_lines.append(f"Chapter {c_num} : {c_title}")
                else:
                    header_lines.append(f"Chapter {c_num}")

                narration_header = "\n\n".join(header_lines)
                formatted_content = f"{narration_header}\n\n{raw_body}"

                client_chapters.append({
                    'id': c['id'],
                    'chapter_number': c_num,
                    'chapter_title': c_title,
                    'content': formatted_content,
                    'audio_url': c.get('audio_url') or ''
                })

            cover = b['cover_url'] or b['cover_external_url'] or b['cover_storage_url'] or ''
            retained_books.append({
                'id': bid,
                'title': book_title,
                'author': book_author,
                'cover_url': cover,
                'cover_external_url': b['cover_external_url'] or '',
                'cover_storage_url': b['cover_storage_url'] or '',
                'total_chapters': len(client_chapters) if len(client_chapters) > 0 else (b['total_chapters'] or 0),
                'audio_chapters_count': chaps_with_audio,
                'chapters': client_chapters
            })

    print(f"\n==========================================")
    print(f"REMOVED BOOKS ({len(removed_books)} books where all chapters audiobooks exist):")
    for rb in removed_books:
        print(f" - [{rb['id']}] {rb['title']} ({rb['audio_chapters']}/{rb['total_chapters']} chapters with audio)")
    
    print(f"\nRETAINED BOOKS ({len(retained_books)} books remaining with narration headers):")
    for b in retained_books:
        if b['audio_chapters_count'] > 0:
            print(f" * Partial: [{b['id']}] {b['title']} ({b['audio_chapters_count']}/{len(b['chapters'])} audio)")

    out_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(out_dir, 'books_data.json')
    js_path = os.path.join(out_dir, 'books_data.js')

    # Save filtered data with narration headers as JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(retained_books, f, ensure_ascii=False, indent=2)
    print(f"\nSaved {json_path} (Size: {os.path.getsize(json_path):,} bytes, {len(retained_books)} books)")

    # Save filtered data with narration headers as JS
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write("window.BOOKS_DATA = ")
        json.dump(retained_books, f, ensure_ascii=False)
        f.write(";\n")
    print(f"Saved {js_path} (Size: {os.path.getsize(js_path):,} bytes)")

if __name__ == '__main__':
    main()
