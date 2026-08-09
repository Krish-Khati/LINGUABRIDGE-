import re

with open("src/App.tsx", "r") as f:
    content = f.read()

replacements = {
    'bg-slate-50': 'bg-slate-50 dark:bg-slate-900',
    'bg-white': 'bg-white dark:bg-slate-800',
    'text-slate-900': 'text-slate-900 dark:text-slate-100',
    'text-slate-800': 'text-slate-800 dark:text-slate-200',
    'text-slate-700': 'text-slate-700 dark:text-slate-300',
    'text-slate-500': 'text-slate-500 dark:text-slate-400',
    'text-slate-400': 'text-slate-400 dark:text-slate-500',
    'text-slate-300': 'text-slate-300 dark:text-slate-600',
    'border-slate-200': 'border-slate-200 dark:border-slate-700',
    'border-slate-100': 'border-slate-100 dark:border-slate-800',
    'shadow-sm': 'shadow-sm dark:shadow-none',
    'shadow-inner': 'shadow-inner dark:shadow-none',
    'bg-slate-100': 'bg-slate-100 dark:bg-slate-800',
    'bg-indigo-50': 'bg-indigo-50 dark:bg-indigo-900/30',
    'hover:bg-indigo-100': 'hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
}

for old, new in replacements.items():
    # Only replace if not already followed by dark:
    content = re.sub(rf'{old}(?!\s+dark:)', new, content)

with open("src/App.tsx", "w") as f:
    f.write(content)
