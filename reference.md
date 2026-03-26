# Projekt-Referenzdokument für ein privates Saat- und Pflanzbuch als Webapp mit Kalender, API und MCP

Stand: 26.03.2026 (Europe/Berlin). citeturn5view3

## Zielbild und Leitprinzipien

Dieses Hobby-Projekt soll das analoge Pflanz- und Saatbuch sowie einen Aussaat-/Pflanzkalender in eine kleine, saubere Webanwendung überführen: Mehrere Benutzer können sich anmelden, eigene (oder gemeinsam geteilte) Sorten- und Saatgutdaten pflegen, Pflanzungen dokumentieren und daraus einen praxistauglichen Kalender inklusive Aufgaben/Erinnerungen ableiten. Der Fokus liegt ausdrücklich auf Nutzpflanzen (Gemüse/Frucht), insbesondere alten/samenfesten Sorten (Erhalt durch regelmäßigen Anbau, Vermehrung, Dokumentation). citeturn3search12turn3search4

Leitprinzipien für Scope & Umsetzung:

- **Datenhoheit & Langlebigkeit:** Self-hosted, einfache Backups/Exports, keine Monetarisierung, kein Vendor Lock-in. (Das ist auch ein klarer Erfolgsfaktor bei bestehenden Lösungen, die „offline-first“ bzw. selbst hostbar sind.) citeturn7search0turn7search1  
- **Kalenderlogik „gärtnerisch sinnvoll“ statt starrer Daten:** Planung soll nicht nur fixe Monatsangaben nutzen, sondern mit *Frostterminen* und optional *phänologischen Jahreszeiten* arbeiten, weil diese regional und jahresabhängig variieren. citeturn2search3turn2search7turn2search1  
- **Kompakter Docker-Stack, Portainer-Deployment:** Wenige Container, klare Volumes, Environment-Variablen, Updates über Portainer Stacks. citeturn5view3turn0search28  
- **API-first (intern), UI-second (darauf aufbauend):** Das Webinterface nutzt denselben Backend-API-Vertrag, damit MCP/Agent später „nativ“ auf denselben Funktionen aufsetzt. (MCP-Tools sind im Kern „Tool-Aufrufe“ mit JSON Schema.) citeturn6search16turn6search2  
- **Sichere „Agent-Fähigkeit“ per Design:** Schreibende Aktionen sind nachvollziehbar (Audit Log), optional bestätigungspflichtig und sauber berechtigt – wichtig, weil MCP/Agent-Tools explizit auch „destruktive“ Aktionen auslösen können. citeturn6search25turn6search8  

## Recherche zu Saat- und Aussaatkalendern sowie bestehenden Systemen

### Was „moderne“ Gartenplaner typischerweise gut machen

Kommerzielle Planer setzen stark auf **lokale Klimadaten** (Wetterstation/Region) und generieren daraus **personalisierte Kalender** und Reminder. citeturn1search3turn1search9turn7search17  
Beispielsweise bewirbt GrowVeg, dass der Kalender aus dem eigenen Plan abgeleitet wird und auf lokalen Klimadaten basiert (inkl. E-Mail-Erinnerungen). citeturn1search3  
VegPlotter und Seedtime verfolgen sehr ähnliche Kernversprechen: *wann säen (innen/außen), wann pflanzen, wann ernten* – in einer Timeline/Monatslogik, die an Standort/„Season“ geknüpft ist. citeturn1search9turn7search17

Ableitung für dein Projekt: Der „Mehrwert“ entsteht weniger durch eine reine Tabellenansicht – sondern durch einen **berechneten Zeitplan** pro Sorte/Variante + Standortprofil, der auch bei Änderungen (z. B. spätere Aussaat) robust bleibt.

### Open-Source / self-hosted Systeme und Feature-Muster

Im Self-hosted-/Open-Source-Umfeld sieht man drei wiederkehrende Muster:

**Kollaboratives Pflanzen-Management mit Aufgaben/Kalender:**  
entity["organization","HortusFox","self-hosted plant manager"] beschreibt sich als kollaboratives, selbst hostbares Pflanzenverwaltungssystem mit Benutzer-Authentifizierung, Aufgaben, Kalender und Historie/Audit-Ansätzen. citeturn7search2turn7search6  
Für dein Projekt ist besonders relevant: Multi-User, Aufgaben und History sind „Standardbausteine“, kein Luxus.

**„Companion App“ für Pflege- und Aktivitätslogging:**  
entity["organization","Plant-it","self-hosted gardening app"] setzt den Schwerpunkt auf Pflege-Tracking, Benachrichtigungen, Bilder und Aktivitäten-Logs. citeturn1search0turn1search5  
Das ist ein gutes Vorbild für deine Logbuch-/Chronik-Funktion (wann ausgesät, pikiert, ausgepflanzt, geerntet, Saatgut gewonnen etc.).

**Gartenjournal mit Saatgutbank & Zeitplan („Serious Gardener“-Suite):**  
Jninty positioniert sich als (selbst hostbare) Garden-Management-PWA mit u. a. Seed Bank, Planting Calendar und Task-Regeln; die Doku nennt explizit Frostdate Awareness und planbasierte Aufgaben. citeturn7search0turn7search1  
Das zeigt: Eine **Seed-Bank** ist nicht „nice-to-have“, sondern Kernbestandteil, wenn man Saatgut über Jahre erhalten möchte.

### Wissen, Datenquellen und „Erhalt alter Sorten“ als Domäne

Wenn dein Ziel **Erhalt** ist, brauchst du Daten, die viele Standard-Gartenapps nicht konsequent modellieren:

- **Saatgut-Bestände als „Batches/Chargen“** (mit Erntejahr, Herkunft, Lagerort, Keimfähigkeitstest, Menge, Mindestabstand/Isolation, Verkreuzungsrisiken). Organisationen, die Sorten erhalten, arbeiten explizit mit Bestand/Registrierung und Übersicht über vorhandenes Saatgut. citeturn3search5turn3search1  
- In Deutschland ist der entity["organization","Verein zur Erhaltung der Nutzpflanzenvielfalt","Witzenhausen, DE"] ein Beispiel für Erhaltung durch regelmäßigen privaten Anbau und Weitergabe; die Website betont samenfeste Sorten und private Nutzung/Erhaltung. citeturn3search12turn3search4  
- entity["organization","ProSpecieRara","Basel, CH"] beschreibt eine Samenbibliothek mit Saatgut von über 1700 seltenen Sorten (Saatgut als Basis zur Erhaltung und Wiederverbreitung). citeturn3search1  
- entity["organization","ARCHE NOAH","Schiltern, AT"] arbeitet als gemeinnütziger Verein für Erhalt/Verbreitung bedrohter Kulturpflanzensorten. citeturn3search2  
- entity["organization","Seed Savers Exchange","Decorah, IA, US"] ist ein (US-)Nonprofit, der Heirloom-Sorten durch Regeneration/Distribution/Exchange erhält. citeturn3search7turn3search31  

Diese Domäne legt nahe: Du solltest **Saatgutbank + Vermehrungs-/Ernteprotokoll + Qualität (Keimfähigkeit)** als First-Class-Features einplanen, nicht nur „Pflanzen-Events“.

### Kalenderlogik: Frosttermine + Phänologie statt „Monat X“

Phänologie ist in Deutschland sehr gut dokumentiert und für Gartenplanung praxisnah:

- Der entity["organization","Deutscher Wetterdienst","Offenbach am Main, DE"] teilt das phänologische Jahr in **10 phänologische Jahreszeiten** ein, fixiert über Leitphasen/Wachstumsstadien ausgewählter Pflanzen (Leitphasen). citeturn2search3turn2search0  
- entity["organization","NABU","Berlin, DE"] erklärt ebenfalls die feinere Einteilung in zehn phänologische Jahreszeiten und die Abhängigkeit von Großwetterlage/Regionalität. citeturn2search1turn2search25  
- Der DWD erhebt phänologische Phasen (Wachstums-/Entwicklungserscheinungen) und dokumentiert auch Eintrittstermine landwirtschaftlicher Arbeiten. citeturn2search7  

Warum das in deinem Projekt „Scope-würdig“ ist: Klassische Saatgut-Tüten arbeiten oft mit groben Monaten; phänologische Orientierung und lokale Frosttermine sind flexibler – besonders, weil sich Jahreszeiten/Phasen verschieben können. Das LfU Bayern beschreibt z. B. einen früheren Beginn von Frühling/Sommer und Veränderungen im Herbstverlauf in den letzten Jahrzehnten. citeturn2search33

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Phänologischer Kalender Zeigerpflanzen Deutschland","Phänologische Uhr DWD","Garten Aussaatkalender Beispiel deutsch","Seed bank garden app interface"],"num_per_query":1}

### Saatgut-Qualität: Lagerung und Keimfähigkeit als Software-Feature

Für Erhalt ist „Saatgut ist vorhanden“ nicht genug – du brauchst eine Idee von Vitalität:

- Keimfähigkeit hängt stark von **Feuchte** und **Temperatur** ab; ein pragmatisches Prinzip ist „kühl & trocken“. Johnny’s Seeds formuliert eine einfache Faustregel (Temperatur in °F + relative Luftfeuchte < 100) und betont „kühl und trocken“ als optimale Lagerbedingung. citeturn4search3  
- Extension-Quellen betonen ebenfalls: trockene/kühle Lagerung verlängert Lebensdauer deutlich. citeturn4search10turn4search30  
- Ein einfacher **Keimtest** (z. B. feuchtes Papierhandtuch, repräsentative Stichprobe, zählen der Keimlinge) ist als Methode gut dokumentiert. citeturn4search8turn4search15  
- Für sehr langfristige Lagerung in Genbanken werden Standards wie -18 °C für Base Collections beschrieben (FAO/Genebank Standards/Interpretationen, u. a. via USDA-Genbankhinweise). citeturn4search4turn4search13  

Ableitung: Deine Saatgutbank sollte „Keimtest-Datum + Ergebnis + Lagerort“ speichern können und daraus Warnungen/Empfehlungen ableiten (z. B. „älteres Saatgut: dichter säen“).

## Produktumfang und Anforderungen

### Zielgruppen, Rollen, Arbeitsmodi

Primärzielgruppe: Du selbst (Power User) + optional Familie/Freunde als weitere Nutzer. Daraus ergeben sich zwei Arbeitsmodi:

- **Private Daten pro Nutzer:** Jeder hat eigenes Saatgutbuch.
- **Gemeinsamer „Hof/Garten“-Workspace:** Mehrere Nutzer pflegen gemeinsam Sorten, Beete, Aufgaben. (Kollaboration ist bei self-hosted Plant-Managern explizit ein Kernfeature.) citeturn7search6turn7search2  

Rollen (Minimalmodell): **Admin**, **Mitglied** (optional später: **Viewer/Read-only**).

### Funktionsumfang, der deinen Ursprungsvorschlag sinnvoll erweitert

Dein Ursprung: „Saat- und Pflanzbuch + Kalender, wann welche Sorten optimal zu pflanzen sind“ wird erweitert um vier praxisnahe Bausteine:

**Saatgutbank („Seed Bank“) als Herzstück:** Samen-Batches mit Herkunft, Erntejahr, Menge, Lagerort, Keimtests, Notizen. Das ist bei „Serious“-Lösungen explizit enthalten. citeturn7search0turn7search1  

**Standort-/Saisonprofil:** Frosttermine (letzter/erster Frost), Saisonstart, optional phänologische Jahreszeit/Indikatorpflanzen als „Realitätsabgleich“. Phänologische Jahreszeiten sind beim DWD als Produkt strukturiert beschrieben. citeturn2search3turn2search7  

**Aufgaben/Reminder aus Kalender ableiten:** Viele Systeme koppeln Kalender → Tasks/Reminders (HortusFox, Jninty). citeturn7search6turn7search0  

**Protokoll/Chronik für Erhaltungsarbeit:** Ernte-Events, Saatgutgewinnung, Isolation/Verkreuzungsnotizen, Beobachtungen (Witterung, Schaderreger), Fotos. Pflege-/Aktivitätslogging ist bei Plant-it zentral. citeturn1search0turn1search5  

### Abgrenzung und bewusstes Nicht-Ziel

Bewusst nicht im Scope (zumindest bis nach MVP):

- Monetarisierung/Shop/Sortenverkauf (explizit ausgeschlossen).
- Große Community-Funktionen (Foren, öffentliches Teilen wie Growstuff). Growstuff ist zwar spannend als Open-Data-Community, aber zu groß für ein kompaktes Hobbyprojekt. citeturn7search3turn7search7  
- „Vollautomatische“ Empfehlungen durch externe KI/Weather APIs als Pflichtbestandteil (kann später kommen; zunächst manuell definierbare Regeln + Standortparameter).

## Architektur, Datenmodell, Docker-Stack und Portainer-Deployment

### Architekturprinzipien

- **Monolithisches Backend + schlankes Web-UI** (ein Repo, eine App), dafür klare Module.
- **Relationale Datenbank** (Transaktionen, Mehrbenutzer, Historie).
- **Dateispeicher** (Fotos/Uploads) auf Volume, optional später S3-kompatibel.
- **Asynchronität minimal halten:** Tasks/Reminder können initial per In-Process-Scheduler laufen; später optional Worker/Queue.

### Vorschlag für einen kompakten Docker-Stack

Minimal (MVP):

- `app`: Backend + Web-UI + REST API + (optionaler) MCP-Server-Endpunkt
- `db`: PostgreSQL
- Optional `reverse-proxy`: nur wenn du TLS/Host-Routing brauchst (oder wenn du bereits eine zentrale Reverse-Proxy-Instanz hast, dann weglassen)

Erweitert (wenn Reminder/Jobs zuverlässig sein sollen):

- `worker` (z. B. Celery/ähnlich) + `redis` als Broker (zusätzliche Komplexität, aber saubere Job-Ausführung)

Portainer-relevante Planungsannahmen:

- Portainer kann Stacks über **Web Editor**, **Upload** oder **Git Repository** deployen; Environment-Variablen können in Portainer gepflegt oder per `.env` geladen werden. citeturn5view3  
- Wenn du Git-Deployment nutzt: Portainer klont das ganze Repo (Platzbedarf) und submodules werden nicht unterstützt; Änderungen am Compose erfolgen dann im Repo, nicht im Portainer-Editor. citeturn5view3turn0search28  

### Datenmodell als Referenz

Kern-Entitäten (relational modelliert):

- **Species** (Art) und **Variety/Cultivar** (Sorte): Namen, Synonyme, Kategorie (Gemüse/Obst/Kraut), Notizen, Besonderheiten (z. B. samenfest, Kreuzungsrisiko).
- **SeedBatch**: gehört zu einer Sorte, enthält Erntejahr, Herkunft (Person/Quelle), Menge/Einheit, Lagerort, Mindesthaltbarkeit (optional), Keimtests (Datum, Stichprobe, Quote, Notiz).
- **SowingProfile** (Planungsprofil pro Standort): letzter Frost, erster Frost, Mikroklima; optional Proxy auf phänologische Jahreszeit als manuell gesetzter Status.
- **CultivationRule** (Regel pro Sorte): Aussaat innen/außen (Fenster relativ zu letzter Frost / phänologischer Phase), Pflanzabstand, Kulturzeit, ggf. Folge-/Staffelsaat.
- **PlantingEvent**: tatsächliche Aussaat/Pflanzung mit Datum, Ort/Beet, Menge, Batch-Referenz.
- **Bed / Plot** (optional MVP+): Beetstruktur/Fläche.
- **LogEntry / Observation**: Chronik inkl. Fotos, Tags, Schädlinge, Erfolge/Misserfolge.
- **Task**: erzeugt aus Regeln oder manuell, Status, Fälligkeit, Zuweisung, Quelle (z. B. „aus PlantingEvent #123“).
- **AuditLog**: wer hat was geändert (wichtig für Multi-User und Agent-Tools).

### Sicherheits- und Betriebsanforderungen

- **Auth:** Session-basiert fürs Web, Token-basiert (API keys oder JWT) für API/MCP.
- **Principle of least privilege:** Schreiboperationen rollenbasiert.
- **Backups:** DB + Upload-Volume; automatisierbar über Cron/Job.
- **Nachvollziehbarkeit:** Audit-Log (insbesondere für Agent-Schreibaktionen).

## Integrationsschicht mit REST API, MCP Server und Agent Skill

### REST API als „System-Vertrag“

Die REST API dient drei Zwecken:

- Web-UI konsumiert dieselbe API (saubere Trennung, testbar).
- Exporte/Automationen (z. B. CSV, iCal).
- MCP-Tools können „thin wrapper“ über dieselben Services sein.

Designprinzip: **OpenAPI-first** (automatisch generierte Doku/Clients).

API-Ressourcen (MVP-Set):

- `/auth/*` (Login, Token, Sessions)
- `/species`, `/varieties`
- `/seed-batches`, `/seed-batches/{id}/germination-tests`
- `/profiles` (Standort-/Saisonprofile)
- `/plantings` (Aussaat/Pflanzung/Ernte-Events)
- `/calendar` (berechnete Sicht)
- `/tasks`
- `/logs` (Chronik/Notizen/Bilder)

### MCP Server: warum und wie im Projekt verankern

MCP ist ein offener Standard, um Tools/Context für LLMs über einen einheitlichen Mechanismus bereitzustellen (JSON-RPC 2.0, Host/Client/Server Rollen). citeturn6search3turn0search6  
Die Spezifikation definiert standardisierte Transports (u. a. stdio, Streamable HTTP). citeturn6search1  
Tools sind eindeutig benannt und beschreiben ihre Parameter via JSON Schema; optional mit Output Schema. citeturn6search16turn6search12  

Relevante Transport-Entscheidung für dein Setup:

- Für lokale/self-hosted Nutzung ist Streamable HTTP naheliegend (Webapp + MCP im selben Netzwerk).
- Gleichzeitig ist **stdio** extrem praktisch für lokale Agent-Setups/CLI und wird von Spezifikationsseiten als „sollte unterstützt werden“ hervorgehoben. citeturn6search1  

Sicherheitsaspekt, den du explizit einplanen solltest: Bei Streamable HTTP nennt die Spezifikation u. a. Origin-Header-Validierung (DNS Rebinding), localhost-binding und Auth für lokale Server. citeturn6search8  

### MCP Tool- und Resource-Design für dieses Projekt

MCP Capabilities, die du nutzen wirst:

- **Tools** für Aktionen/Abfragen (z. B. „berechne Kalender“, „lege Aussaat an“)
- **Resources** als Kontext (z. B. „gib Sorte X als strukturierte Resource zurück“, „gib Kalender als Resource-Link zurück“) citeturn6search6turn6search2  
- **Prompts** (optional) als wiederverwendbare System-/Workflow-Prompts.

Vorgeschlagene Tool-Suite (MVP):

- `calendar_preview` (read-only): berechnet „Was ist diese Woche zu säen/pflanzen?“ für ein Profil
- `seed_batch_status` (read-only): Menge, Alter, letzter Keimtest, Empfehlung „dichter säen?“ (ableitbar aus Keimquote; Keimtest-Methode ist etabliert) citeturn4search8turn4search15  
- `create_planting_event` (write): Aussaat/Pflanzung anlegen (mit Batch, Datum, Ort)
- `log_observation` (write): Notiz/Fotos/Tags
- `list_varieties` / `get_variety` (read-only)
- `create_task` / `complete_task` (write)

Vorgeschlagene Schutzmaßnahmen:

- Tool-Metadaten/Annotations: Markiere Tools als read-only vs. write (und ggf. „needs_confirmation“ in eigener Konvention), damit Agent-Clients korrekt filtern/fragen können (Best Practices sind ausführlich dokumentiert). citeturn6search25turn6search20  
- Für write-Tools: verpflichtend `dry_run=true` unterstützen (zuerst Vorschau, dann Commit).
- AuditLog-Eintrag je Tool-Call.

### Agent Skill: „Garten- und Erhaltungsassistent“ als definierter Workflow

Der Agent Skill ist eine „Skill-Definition“ (Prompt + Toolset + Sicherheitsregeln), die z. B. in OpenAI Agents SDK oder anderen MCP-fähigen Frameworks implementiert werden kann. OpenAI’s Agents SDK dokumentiert explizit mehrere MCP-Transportoptionen (hosted, Streamable HTTP, SSE, stdio). citeturn5view0  

Skill-Ziele:

- **Wochenplan**: „Was soll ich diese Woche vorziehen / direkt säen / pikieren / auspflanzen?“ (aus Kalender + Profil)
- **Erhaltungsmodus**: „Welche Sorten müssen dieses Jahr angebaut werden, damit die Linie erhalten bleibt?“ (aus Saatgutbestand + letztem Anbaujahr)
- **Saatgutqualität**: „Welche Chargen sind alt/ohne Keimtest → Keimtest vorschlagen?“ (Keimtest-Workflow ist standardisiert). citeturn4search8turn4search15  

Nicht-Ziel: Der Agent soll nicht „kreativ halluzinieren“, sondern ausschließlich aus deinem Datenbestand + deinen Regeln argumentieren und bei Unsicherheit nachfragen.

## Projekt-Backlog als Epics mit User Stories und Tasks

Konventionen:
- **MVP** = Minimal nutzbar für dein aktuelles Saat-/Pflanzbuch + Kalender + Multi-User.
- **V1** = solide, alltagstauglich, mit Import/Export, Reminder, MCP.
- **V2** = Komfort/Automatisierung/Erweiterungen.

### Epic: Produktdefinition und Arbeitsgrundlagen

**Ziel:** Ein eindeutiger Scope, gemeinsame Sprache (Begriffe), Akzeptanzkriterien.

User Stories:
1. Als Admin möchte ich einen „Glossar“-Bereich (Begriffe wie Sorte/Charge/Keimtest), damit Nutzer konsistent pflegen. (V1)  
   Akzeptanz: Bearbeitbar, versionierbar, UI-Widget „?“.

Tasks:
- Domänenglossar (SeedBatch, Variety, PlantingEvent, Profile, Rule, Task, LogEntry) definieren.
- Datenklassen/Entity-Liste finalisieren.
- MVP/V1/V2-Scope festnageln (einseitiges Scope-Dokument).
- UX-Northstar: 3 Kern-Screens definieren (Dashboard, Sorten/Chargen, Kalender).

### Epic: Authentifizierung, Benutzer- und Workspace-Modell

**Ziel:** Multi-User Login, sauberer Zugriff, optional gemeinsamer Workspace.

User Stories:
1. Als Nutzer möchte ich mich anmelden/abmelden, damit meine Daten geschützt sind. (MVP)  
   Akzeptanz: Passwort-Login, Session-Timeout, „Passwort ändern“.

2. Als Admin möchte ich Benutzer einladen/deaktivieren, damit ich den Zugriff steuere. (MVP)  
   Akzeptanz: Invite-Link oder Admin erstellt Account, Deaktivierung sperrt Login.

3. Als Nutzer möchte ich zwischen „Privat“ und „Gemeinschafts-Garten“ wechseln können, damit Daten getrennt oder geteilt sind. (V1)

Tasks:
- User-Entity + Passwort-Hashing; Rollenmodell (Admin/Member).
- Workspace-Entity (private default, optional shared).
- Globaler Permission-Checker (API + UI).
- Basis-Audit: „Wer hat wann welche Entität geändert?“.

### Epic: Sorten- und Artenkatalog

**Ziel:** Sorten als langlebige Wissenseinheiten (auch alte/samenfeste Sorten).

User Stories:
1. Als Nutzer möchte ich Arten und Sorten anlegen und mit Synonymen/Notizen versehen, damit ich historische Namen und Quellen dokumentiere. (MVP)  
2. Als Nutzer möchte ich Sorten nach Kategorie/Tags suchen und filtern, damit ich Bestände schnell finde. (MVP)  
3. Als Nutzer möchte ich pro Sorte Kulturinfos pflegen (Abstand, Kulturzeit, Notizen), damit Kalenderberechnung möglich ist. (MVP)

Tasks:
- DB-Modelle: Species, Variety, Tags, Synonyms.
- UI: Liste + Detail + Suche/Filter.
- Import/Export (CSV) für Sorten (V1).
- Optional: „Quelle/Organisation“ als Freitext/Referenz (ohne Fremdlizenzen).

### Epic: Saatgutbank und Chargenverwaltung

**Ziel:** Saatgut als Bestandsobjekt, inkl. Qualität und Historie.

User Stories:
1. Als Nutzer möchte ich pro Sorte Chargen (Erntejahr/Herkunft/Menge/Lagerort) anlegen, damit ich echte Bestände verwalte. (MVP)  
2. Als Nutzer möchte ich Keimtests dokumentieren (Datum, Stichprobe, Keimquote), damit ich die Qualität einschätzen kann. (V1)  
   Akzeptanz: Keimtest-Workflow orientiert sich an etabliertem Paper-Towel-Verfahren (Stichprobe, zählen). citeturn4search8turn4search15  
3. Als Nutzer möchte ich Warnungen sehen („Charge alt/kein Keimtest/geringe Quote“), damit ich rechtzeitig nachvermehre. (V1)  
4. Als Nutzer möchte ich bei Aussaat die Charge auswählen und die Menge reduzieren, damit Bestandspflege stimmt. (MVP)

Tasks:
- DB: SeedBatch, GerminationTest, StorageLocation (enum/freitext).
- UI: Batch-Liste je Sorte, Batch-Detail, Schnellerfassung.
- „Verbrauch“: bei PlantingEvent Menge reduzieren (mit Undo/Correction).
- Heuristik-Regeln als Konfiguration (z. B. Warnschwelle Keimquote < 70% als Default-Anhalt). citeturn4search15  
- Export: Saatgutbank als CSV/JSON (V1).

### Epic: Standort- und Saisonprofile mit phänologischer Option

**Ziel:** Kalender wird lokal sinnvoll: Frosttermine + optional phänologische Jahreszeit.

User Stories:
1. Als Nutzer möchte ich ein Standortprofil anlegen (Garten A, Balkon B) mit letztem/erstem Frost und Notizen (Mikroklima), damit der Kalender passt. (MVP)  
2. Als Nutzer möchte ich optional eine phänologische Jahreszeit manuell setzen/tracken, damit ich starre Datumsfenster an die Natur anpassen kann. (V1)  
   Akzeptanz: UI zeigt 10 phänologische Jahreszeiten als Auswahl/Info. citeturn2search3turn2search1  

Tasks:
- DB: Profile (Name, Region, last_frost, first_frost, notes, pheno_season optional).
- UI: Profilverwaltung; „aktives Profil“.
- Datenhilfe: kurze Info „was ist Phänologie“ (DWD/NABU-basiert) als Tooltip/Help. citeturn2search7turn2search1  

### Epic: Kalender-Engine für Saat, Pflanzung, Pflege und Ernte

**Ziel:** Aus Regeln + Profil einen praxistauglichen Kalender generieren.

User Stories:
1. Als Nutzer möchte ich pro Sorte Regeln pflegen (Aussaat innen/außen, Auspflanzen, Erntefenster), damit mein Kalender automatisch berechnet wird. (MVP)  
2. Als Nutzer möchte ich im Kalender „Plan“ und „Ist“ sehen, damit Abweichungen nachvollziehbar sind. (V1)  
3. Als Nutzer möchte ich Staffel-/Folgesaat planen (z. B. alle 2 Wochen), damit der Kalender mehrere Durchgänge abbildet. (V1)

Tasks:
- Regelmodell: relative Fenster (z. B. „-8 bis -6 Wochen vor letztem Frost“), absolute Fenster (Monat/Woche), optional phänologische Trigger.
- Kalenderberechnung: erzeugt „Kalenderereignisse“ (planbar) + bindet Ist-Events.
- UI: Monatsansicht + Listenansicht „nächste 14 Tage“ (an GrowVeg/Seedtime-Pattern angelehnt: nächster Zeitraum ist in der Praxis entscheidend). citeturn1search3turn7search17  
- Kalender-Export (iCal) (V1).

### Epic: Pflanz- und Erntebuch als Chronik

**Ziel:** Dein analoges Buch wird digital: nachvollziehbare Historie.

User Stories:
1. Als Nutzer möchte ich PlantingEvents (Aussaat/Pikieren/Auspflanzen/Ernte/Saatgutgewinnung) erfassen, damit ich eine vollständige Chronik habe. (MVP)  
2. Als Nutzer möchte ich Beobachtungen mit Fotos und Tags speichern, damit ich Lernwissen pro Saison aufbaue. (V1)  
3. Als Nutzer möchte ich Auswertungen „Sorte X über Jahre“ sehen, damit ich Verbesserungen erkenne. (V2)

Tasks:
- Eventtypen definieren (inkl. Saatgutgewinnung als eigener Typ).
- Upload-Handling (Fotos), Thumbnailing.
- UI: Timeline pro Sorte & pro Saison.
- Such-/Filter: nach Saison, Ort, Sorte, Tag.

### Epic: Aufgaben- und Reminder-System

**Ziel:** Kalender erzeugt konkrete To-dos, optional Benachrichtigungen.

User Stories:
1. Als Nutzer möchte ich Aufgaben aus Kalenderregeln automatisch sehen, damit ich nichts vergesse (z. B. „Aussaat Tomate vorziehen“). (V1)  
2. Als Nutzer möchte ich Aufgaben abhaken und kommentieren, damit der Verlauf vollständig ist. (V1)  
3. Als Nutzer möchte ich optionale Reminder (E-Mail oder Push/Web) konfigurieren, damit ich rechtzeitig erinnert werde. (V2)

Tasks:
- Task-Modell (due_date, status, source_ref).
- Generator: nightly job oder on-demand.
- UI: „Heute / Diese Woche / Überfällig“.
- Notification-Adapter (E-Mail als erster, alles andere später).

### Epic: Import/Export und Datensicherung

**Ziel:** Daten bleiben transportabel und sicher.

User Stories:
1. Als Nutzer möchte ich vollständige Exporte (JSON/CSV) erstellen, damit ich unabhängig bleibe. (V1)  
2. Als Admin möchte ich ein Backup-Konzept (DB + Uploads) dokumentieren und automatisieren, damit ich keine Daten verliere. (V1)

Tasks:
- Export-Endpunkte + UI Download.
- Backup-Job (db dump + tar uploads) in Volume.
- Restore-Runbook (Schritt-für-Schritt).
- Optional: Verschlüsselung der Backup-Dateien.

### Epic: REST API Härtung und Dokumentation

**Ziel:** Sauber dokumentierte, stabile API als Grundlage für UI, Automationen, Agent.

User Stories:
1. Als Entwickler möchte ich eine OpenAPI-Doku mit Beispielen, damit Clients schnell gebaut werden. (MVP)  
2. Als Admin möchte ich API-Tokens erstellen/rotieren, damit MCP/Agent sicher zugreifen kann. (V1)

Tasks:
- OpenAPI Generator integriert.
- Versionierung (v1).
- Rate limiting / basic abuse protection.
- API tests (contract tests).

### Epic: MCP Server und Tooling

**Ziel:** MCP-konforme Tools/Resources/Prompts anbieten.

User Stories:
1. Als Power User möchte ich einen MCP Server nutzen, damit ein Agent meinen Kalender abfragen kann. (V1)  
   Akzeptanz: JSON-RPC 2.0, stdio + Streamable HTTP, Tools mit JSON Schema. citeturn6search3turn6search1turn6search16  
2. Als Admin möchte ich MCP sicher betreiben (Auth, localhost-binding, Origin-Checks), damit lokale Dienste nicht angreifbar sind. (V1) citeturn6search8  

Tasks:
- MCP Server Skeleton (Transport-Abstraktion).
- Tool Registry: `list_varieties`, `calendar_preview`, `create_planting_event`, `log_observation`, `seed_batch_status`.
- OutputSchema für strukturierte Ergebnisse (wo sinnvoll). citeturn6search12  
- Security: Token-auth, origin validation, CORS/Origin Policy.
- Resource Links (z. B. „kalender://week/2026-13“) + `resources/read`. citeturn6search6turn6search2  

### Epic: Agent Skill Paket

**Ziel:** Wiederverwendbarer Skill, der Tools sinnvoll orchestriert.

User Stories:
1. Als Nutzer möchte ich „Was soll ich diese Woche im Garten tun?“ fragen können und eine begründete, datenbasierte Antwort erhalten. (V1)  
2. Als Nutzer möchte ich „Welche Sorten sind erhaltungs-kritisch?“ fragen können, basierend auf letztem Anbaujahr/Bestand/Keimquote. (V2)

Tasks:
- Skill Prompt/Policy: „Nur Daten aus Tools verwenden, Unsicherheit markieren“.
- Tool-Call Playbooks: Wochenplan, Keimtest-Vorschläge, Erhaltungscheckliste.
- Integration-Beispiel für mindestens ein Agent-Framework (z. B. mit OpenAI Agents SDK MCP-Anbindung, da diese die MCP-Optionen dokumentiert). citeturn5view0  

### Epic: UI/UX Qualität und Polishing

**Ziel:** „Klein, aber professionell“: schnell, mobil, verständlich.

User Stories:
1. Als Nutzer möchte ich das System am Handy im Garten nutzen, damit ich sofort loggen kann. (V1)  
2. Als Nutzer möchte ich schnelle Eingaben (Quick Log), damit das „Buchführen“ nicht nervt. (V1)  

Tasks:
- Responsive Design (Mobile first Kernflows).
- Quick-Create (Event, Task, Notiz).
- Tastatur-Shortcuts (Desktop).
- Accessibility Basics.

## Qualität, Betrieb, Datenschutz und Release-Plan

### Teststrategie und Definition of Done

Definition of Done (pro Story):

- Implementiert + Code Review (auch im Hobby: „1x selbst-review“).
- Unit Tests für Regel-/Kalenderlogik (hochwertig, weil hier Fehler teuer sind).
- API Contract Tests für Kernendpunkte.
- Migrations sauber (DB Schema versioniert).
- Dokumentation aktualisiert (README + Runbook).

### Datenschutz und Sicherheitsbaseline

Auch als Privatprojekt gilt: keine unnötigen Daten sammeln, sichere Defaults.

- Minimaler PII-Satz (Username/E-Mail optional).
- Passwörter sicher gehasht.
- Rollen/Permissions überall (UI + API + MCP).
- MCP Streamable HTTP nur mit Auth und sicherem Binding/Origin-Checks betreiben. citeturn6search8  

### Betrieb mit Portainer

Runbook-Inhalte:

- Stack deployen: Compose via Portainer (Web Editor/Upload/Git). citeturn5view3  
- Update-Prozess: bei Git-Deploy Pull + Redeploy; Hinweis, dass Portainer-Editor nur bei Web-Editor-Stacks verfügbar ist. citeturn0search28  
- Environment Variablen Handling via Portainer (`.env`/stack env). citeturn5view3  

### Release-Plan

- **MVP (digitales Buch + Basis-Kalender):** Auth, Sorten, SeedBatch, Profil, Regeln, Kalenderliste „nächste 14 Tage“, PlantingEvents (Ist).  
- **V1 (alltagstauglich + Integrationen):** Tasks, Keimtest, Warnungen, Export, OpenAPI-Doku, MCP Server, Agent Skill v1.  
- **V2 (Komfort & Erweiterungen):** Beetplaner/Rotation, mehr Reminder-Channels, Auswertungen über Jahre, phänologische Assistenz vertieft.  

Diese Staffelung spiegelt auch wider, was sich in existierenden Lösungen bewährt: Kalender + Seed Bank + Tasks sind der „Kern“, Community/Advanced Analytics sind optional. citeturn7search0turn7search6turn1search3
