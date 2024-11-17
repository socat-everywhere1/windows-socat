start .\\node_modules\\.bin\\tsc --p tsconfig.json
pause
start .\\node_modules\\.bin\\pkg output\\test.js --targets node8-win-x64 -o .\\shadowsocat.exe
pause