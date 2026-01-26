export interface JiraAttachmentInfo {
    filename: string
    content: string // URL to the full image
    thumbnail?: string // URL to thumbnail
    mimeType: string
}

/**
 * Composable for converting Jira markup to HTML
 */
export function useJiraMarkup() {
    /**
       * Convert Jira markup text to HTML
       * @param text The Jira markup text
       * @param attachments Optional map of filename -> attachment info for resolving image URLs
       */
    const convertToHtml = (text: string, attachments?: Map<string, JiraAttachmentInfo>): string => {
        if (!text) return ''

        let html = text
            // Escape HTML first
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

        // Code block: {code}...{code} - process first to avoid inner replacements
        html = html.replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/g, (_match, lang, code) => {
            const langLabel = lang ? `<span class="code-lang">${lang}</span>` : ''
            return `<div class="code-block">${langLabel}<pre><code>${code.trim()}</code></pre></div>`
        })

        // Blockquote: {quote}...{quote}
        html = html.replace(/\{quote\}([\s\S]*?)\{quote\}/g, '<blockquote class="jira-quote">$1</blockquote>')

        // Panel: {panel}...{panel}
        html = html.replace(/\{panel(?::([^}]*))?\}([\s\S]*?)\{panel\}/g, (_match, title, content) => {
            const titleHtml = title ? `<div class="panel-title">${title}</div>` : ''
            return `<div class="jira-panel">${titleHtml}<div class="panel-content">${content.trim()}</div></div>`
        })

        // Note: {note}...{note}
        html = html.replace(/\{note(?::([^}]*))?\}([\s\S]*?)\{note\}/g, (_match, title, content) => {
            const titleHtml = title ? `<div class="note-title">${title}</div>` : ''
            return `<div class="jira-note">${titleHtml}<div class="note-content">${content.trim()}</div></div>`
        })

        // Headers: h1. h2. h3. etc (must be at start of line)
        html = html.replace(/^h1\.\s*(.+)$/gm, '<h1>$1</h1>')
        html = html.replace(/^h2\.\s*(.+)$/gm, '<h2>$1</h2>')
        html = html.replace(/^h3\.\s*(.+)$/gm, '<h3>$1</h3>')
        html = html.replace(/^h4\.\s*(.+)$/gm, '<h4>$1</h4>')
        html = html.replace(/^h5\.\s*(.+)$/gm, '<h5>$1</h5>')
        html = html.replace(/^h6\.\s*(.+)$/gm, '<h6>$1</h6>')

        // Bold: *text*
        html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')

        // Italic: _text_
        html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>')

        // Strikethrough: -text- (but not ----)
        html = html.replace(/(?<!-)-([^-\n]+)-(?!-)/g, '<del>$1</del>')

        // Underline: +text+
        html = html.replace(/\+([^+\n]+)\+/g, '<u>$1</u>')

        // Monospace: {{text}}
        html = html.replace(/\{\{([^}]+)\}\}/g, '<code class="inline-code">$1</code>')

        // Color: {color:red}text{color}
        html = html.replace(/\{color:([^}]+)\}([\s\S]*?)\{color\}/g, '<span style="color: $1">$2</span>')

        // User mentions: [~username] or [~accountId:xxx]
        html = html.replace(/\[~([^\]]+)\]/g, '<span class="user-mention">@$1</span>')

        // Images: !image.png! or !image.png|thumbnail! or !http://url/image.png!
        html = html.replace(/!([^|!\n]+)(?:\|([^!]+))?!/g, (_match, src, options) => {
            let imgSrc = src.trim()
            const isAbsoluteUrl = /^https?:\/\//i.test(imgSrc)

            // Parse options (thumbnail, width, height, etc.)
            let imgClass = 'jira-image'
            let imgStyle = ''
            let useThumbnail = false

            if (options) {
                const optList = options.split(',').map((o: string) => o.trim().toLowerCase())
                if (optList.includes('thumbnail') || optList.includes('thumb')) {
                    imgClass += ' thumbnail'
                    useThumbnail = true
                }
                // Width/height options like width=300
                optList.forEach((opt: string) => {
                    const widthMatch = opt.match(/width=(\d+)/)
                    const heightMatch = opt.match(/height=(\d+)/)
                    if (widthMatch) imgStyle += `max-width: ${widthMatch[1]}px; `
                    if (heightMatch) imgStyle += `max-height: ${heightMatch[1]}px; `
                })
            }

            const styleAttr = imgStyle ? ` style="${imgStyle}"` : ''

            // Try to resolve attachment URL
            if (!isAbsoluteUrl && attachments) {
                const attachment = attachments.get(imgSrc)
                if (attachment) {
                    // Use thumbnail if requested and available, otherwise use full content URL
                    imgSrc = (useThumbnail && attachment.thumbnail) ? attachment.thumbnail : attachment.content
                    return `<img src="${imgSrc}" alt="${src.trim()}" class="${imgClass}"${styleAttr} loading="lazy" />`
                }
            }

            // For non-resolved attachments, mark with data attribute for potential later resolution
            if (!isAbsoluteUrl) {
                return `<img src="" alt="${imgSrc}" class="${imgClass}" data-attachment="${imgSrc}"${styleAttr} loading="lazy" />`
            }

            return `<img src="${imgSrc}" alt="image" class="${imgClass}"${styleAttr} loading="lazy" />`
        })

        // Links: [text|url] or [url]
        html = html.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        html = html.replace(/\[((https?:\/\/|www\.)[^\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')

        // Bullet list: * item (at start of line)
        html = html.replace(/^\*\s+(.+)$/gm, '<li class="bullet">$1</li>')

        // Numbered list: # item
        html = html.replace(/^#\s+(.+)$/gm, '<li class="numbered">$1</li>')

        // Horizontal rule: ----
        html = html.replace(/^-{4,}$/gm, '<hr />')

        // Wrap consecutive bullet items in <ul>
        html = html.replace(/(<li class="bullet">.*?<\/li>\n?)+/g, (match) => {
            return `<ul>${match}</ul>`
        })

        // Wrap consecutive numbered items in <ol>
        html = html.replace(/(<li class="numbered">.*?<\/li>\n?)+/g, (match) => {
            return `<ol>${match}</ol>`
        })

        // Convert double line breaks to paragraph breaks
        html = html.replace(/\n\n+/g, '</p><p>')

        // Convert single line breaks to <br>
        html = html.replace(/\n/g, '<br>')

        // Wrap in paragraph if not starting with block element
        if (!html.match(/^<(h[1-6]|ul|ol|div|blockquote|pre|hr)/)) {
            html = `<p>${html}</p>`
        }

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '')
        html = html.replace(/<p>(<(h[1-6]|ul|ol|div|blockquote|pre|hr))/g, '$1')
        html = html.replace(/(<\/(h[1-6]|ul|ol|div|blockquote|pre)>)<\/p>/g, '$1')

        return html
    }

    /**
       * Insert formatting at cursor position in a textarea
       */
    const insertFormatting = (
        textareaSelector: string,
        modelValue: Ref<string>,
        before: string,
        after: string = before
    ) => {
        const textarea = document.querySelector(textareaSelector) as HTMLTextAreaElement
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = modelValue.value
        const selectedText = text.substring(start, end) || 'testo'

        const newText = text.substring(0, start) + before + selectedText + after + text.substring(end)
        modelValue.value = newText

        // Restore focus and selection
        nextTick(() => {
            textarea.focus()
            textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
        })
    }

    return {
        convertToHtml,
        insertFormatting
    }
}
