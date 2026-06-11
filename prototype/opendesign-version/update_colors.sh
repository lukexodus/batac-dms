for file in *.html; do
    sed -i 's/--primary: 220 100% 33%; \/\* Batac Blue \*\//--primary: 139 82.4% 35.7%; \/\* Extracted Green \*\//g' "$file"
    sed -i 's/--secondary: 49 97% 54%; \/\* Batac Gold \*\//--secondary: 220 93% 56%; \/\* Extracted Blue \*\//g' "$file"
    sed -i 's/--destructive: 359 85% 44%; \/\* Batac Red \*\//--destructive: 0 100% 48.4%; \/\* Extracted Red \*\//g' "$file"
done
