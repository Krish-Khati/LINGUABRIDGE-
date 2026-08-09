import re

with open("src/App.tsx", "r") as f:
    content = f.read()

replacements = {
    'dark:text-slate-400': 'dark:text-slate-300',
    'dark:text-slate-500': 'dark:text-slate-400',
    'dark:text-slate-600': 'dark:text-slate-500',
    'dark:bg-slate-900/50': 'dark:bg-slate-900',
    'disabled:bg-slate-200': 'disabled:bg-slate-200 dark:disabled:bg-slate-700',
    'disabled:bg-slate-300': 'disabled:bg-slate-300 dark:disabled:bg-slate-700',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open("src/App.tsx", "w") as f:
    f.write(content)
