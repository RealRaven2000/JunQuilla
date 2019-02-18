set /P JunQuillaRev=<revision.txt
set /a oldRev=%JunQuillaRev%
set /a JunQuillaRev+=1
pwsh -Command "(gc -en UTF8NoBOM install.rdf) -replace 'pre%oldRev%', 'pre%JunQuillaRev%' | Out-File install.rdf"
"C:\Program Files\7-Zip\7z" a -xr!.svn JunQuilla.zip install.rdf chrome.manifest content components defaults locale skin smcontent license.txt
echo %JunQuillaRev% > revision.txt
move *.xpi "..\..\_Test Versions\1.1\"
rename JunQuilla.zip JunQuilla-1.1pre%JunQuillaRev%.xpi