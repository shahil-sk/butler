import os
import re

def remove_import(file_path, module_name):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Remove single line imports
    content = re.sub(rf'^.*import.*{module_name}.*\n', '', content, flags=re.MULTILINE)
    
    with open(file_path, 'w') as f:
        f.write(content)

# Fix AI events
remove_import('src/modules/ai/events.ts', 'useNoteStore')
# Also remove the note references in AI events manually or by replacing block
with open('src/modules/ai/events.ts', 'r') as f:
    ai_content = f.read()
ai_content = re.sub(r'bus\.on\("ai:ask-about-note"[\s\S]*?\}\);', '', ai_content)
with open('src/modules/ai/events.ts', 'w') as f:
    f.write(ai_content)

# Fix TaskDetail.tsx
with open('src/modules/tasks/components/TaskDetail.tsx', 'r') as f:
    td_content = f.read()
td_content = re.sub(r'^.*useNoteStore.*\n', '', td_content, flags=re.MULTILINE)
td_content = re.sub(r'const notes = useNoteStore.*?;', '', td_content)
# Remove linked notes UI
td_content = re.sub(r'\{/\* LINKED NOTES \*/\}[\s\S]*?</div>\s*</div>\s*</div>', '</div>\n</div>', td_content)
with open('src/modules/tasks/components/TaskDetail.tsx', 'w') as f:
    f.write(td_content)

# Fix Calendar views
for f_name in ['AgendaView.tsx', 'DayView.tsx', 'EventForm.tsx', 'index.tsx']:
    path = f'src/modules/calendar/{f_name}'
    if os.path.exists(path):
        remove_import(path, 'useNoteStore')
        with open(path, 'r') as f:
            c = f.read()
        c = re.sub(r'const notes.*useNoteStore.*?;', '', c)
        c = re.sub(r'const loadNotes = useNoteStore.*?;', '', c)
        c = re.sub(r'void loadNotes\(\);', '', c)
        c = re.sub(r'\(useNoteStore\.getState\(\) as any\)\.openNote\?\.?\(.*?id\);', '', c)
        with open(path, 'w') as f:
            f.write(c)

# Fix EntityBadge.tsx
with open('src/shared/EntityBadge.tsx', 'r') as f:
    c = f.read()
c = re.sub(r'^.*useNoteStore.*\n', '', c, flags=re.MULTILINE)
c = re.sub(r'const note =.*useNoteStore.*?;', 'const note = undefined;', c)
with open('src/shared/EntityBadge.tsx', 'w') as f:
    f.write(c)

# Fix Search events
with open('src/modules/search/events.ts', 'r') as f:
    c = f.read()
c = re.sub(r'^.*useResearchStore.*\n', '', c, flags=re.MULTILINE)
c = re.sub(r'const source =.*useResearchStore.*?;', 'const source = undefined;', c)
c = re.sub(r'const chunk =.*useResearchStore.*?;', 'const chunk = undefined;', c)
with open('src/modules/search/events.ts', 'w') as f:
    f.write(c)

# Fix IntegrationLayer.tsx
with open('src/shell/IntegrationLayer.tsx', 'r') as f:
    c = f.read()
c = re.sub(r'^.*useNoteStore.*\n', '', c, flags=re.MULTILINE)
c = re.sub(r'^.*useJournalStore.*\n', '', c, flags=re.MULTILINE)
c = re.sub(r'^.*useDatabaseStore.*\n', '', c, flags=re.MULTILINE)
c = re.sub(r'^.*useResearchStore.*\n', '', c, flags=re.MULTILINE)
c = re.sub(r'^.*setupResearchEventListeners.*\n', '', c, flags=re.MULTILINE)

# Remove unsubs using those stores. We can just regex them out since they are bus.on blocks
# Or simpler: empty the file and just keep what we need? No, we need other event listeners.
# Let's replace any block starting with `unsubs.push(bus.on("note:` up to `}));`
c = re.sub(r'unsubs\.push\(bus\.on\("note:[\s\S]*?\}\)\);', '', c)
c = re.sub(r'unsubs\.push\(bus\.on\("journal:[\s\S]*?\}\)\);', '', c)
c = re.sub(r'unsubs\.push\(bus\.on\("database:[\s\S]*?\}\)\);', '', c)
c = re.sub(r'unsubs\.push\(bus\.on\("research:[\s\S]*?\}\)\);', '', c)

# Some blocks are focus:session-completed that use journal
c = re.sub(r'unsubs\.push\(bus\.on\("focus:session-completed", \(\{ session \} \)=> \{[\s\S]*?useJournalStore[\s\S]*?\}\)\);', '', c)

# meetings:ended
c = re.sub(r'unsubs\.push\(bus\.on\("meeting:ended", \(\{[\s\S]*?useNoteStore[\s\S]*?\}\)\);', '', c)

# project:deleted that removes journal links
c = re.sub(r'unsubs\.push\(bus\.on\("project:deleted", \(\{ projectId \}\) => \{[\s\S]*?useJournalStore[\s\S]*?\}\)\);', '', c)
c = re.sub(r'unsubs\.push\(bus\.on\("project:updated", \(\{ project, changed \}\) => \{[\s\S]*?useJournalStore[\s\S]*?\}\)\);', '', c)
c = re.sub(r'unsubs\.push\(bus\.on\("task:completed", \(\{[\s\S]*?useJournalStore[\s\S]*?\}\)\);', '', c)

# other occurrences of useJournalStore, useNoteStore inside functions.
c = re.sub(r'useJournalStore.*?getOrCreateDaily.*?;\n', '', c)

with open('src/shell/IntegrationLayer.tsx', 'w') as f:
    f.write(c)

print("done script")
