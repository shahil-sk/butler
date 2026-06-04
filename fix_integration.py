import re

def remove_event_blocks(text, markers):
    idx = 0
    while True:
        start = text.find('unsubs.push(bus.on(', idx)
        if start == -1:
            break
        
        brace_level = 0
        paren_level = 0
        in_string = False
        in_escape = False
        end = -1
        
        for i in range(start, len(text)):
            char = text[i]
            if in_escape:
                in_escape = False
                continue
            if char == '\\':
                in_escape = True
                continue
            if char in '"\'`':
                if not in_string:
                    in_string = char
                elif in_string == char:
                    in_string = False
                continue
                
            if not in_string:
                if char == '(':
                    paren_level += 1
                elif char == ')':
                    paren_level -= 1
                elif char == '{':
                    brace_level += 1
                elif char == '}':
                    brace_level -= 1
                    
            if paren_level == 0 and brace_level == 0 and i > start + 15:
                # end of unsubs.push(...) is ')'
                # then ';'
                end = i + 1
                while end < len(text) and text[end] in ' \t;':
                    end += 1
                if end < len(text) and text[end] == '\n':
                    end += 1
                break
                
        if end != -1:
            block = text[start:end]
            if any(m in block for m in markers):
                text = text[:start] + text[end:]
            else:
                idx = end
        else:
            idx = start + 1
            
    return text

with open('src/shell/IntegrationLayer.tsx', 'r') as f:
    text = f.read()

text = remove_event_blocks(text, ['useNoteStore', 'useJournalStore', 'useDatabaseStore', 'useResearchStore', 'note:link-to-task', 'note:deleted', 'note:created', 'note:updated', 'journal:entry-created', 'journal:open-date', 'database:created', 'research:linked-to-note', 'research:linked-to-task', 'research:source-imported', 'research:highlight-created', 'research:collect-highlights'])

# Also there might be unsubs.push(setupResearchEventListeners());
text = re.sub(r'^.*setupResearchEventListeners.*$', '', text, flags=re.MULTILINE)

# Remove imports
text = re.sub(r'^.*useNoteStore.*$', '', text, flags=re.MULTILINE)
text = re.sub(r'^.*useJournalStore.*$', '', text, flags=re.MULTILINE)
text = re.sub(r'^.*useDatabaseStore.*$', '', text, flags=re.MULTILINE)
text = re.sub(r'^.*useResearchStore.*$', '', text, flags=re.MULTILINE)

# Remove empty lines
text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)

with open('src/shell/IntegrationLayer.tsx', 'w') as f:
    f.write(text)
