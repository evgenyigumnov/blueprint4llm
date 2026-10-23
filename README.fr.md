# blueprint4llm

**Langues :** [English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [中文](README.zh.md) | [हिन्दी](README.hi.md) | [Français](README.fr.md) | [العربية](README.ar.md)

**Plans Markdown → diagrammes, prototypes d’interface, graphiques, HTML et PDF.**

Rédigez un plan vous-même ou avec un agent. Examinez le système et les écrans avant la mise en œuvre.
Markdown reste la source de référence ; la CLI le génère sans appeler de LLM.

![Fichier Markdown à côté de son diagramme Mermaid généré, d’un écran Balsamiq et d’un graphique d’état des demandes](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/markdown-to-visual.png)

## Exemple représentatif

Découvrez un [`plan.md`](examples/representative-plan.md) représentatif et comparez ses rendus [HTML](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.html) et [PDF](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.pdf).

## Démarrage rapide

### Utiliser avec Codex ou Claude Code

Depuis le répertoire de votre projet, installez la skill `blueprint4llm` avec la [CLI skills](https://github.com/vercel-labs/skills) :

```bash
# Codex
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent codex

# Claude Code
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent claude-code
```

L’installateur nécessite **Node.js ≥22.20.0** et npm. Par défaut, il installe la skill pour le projet actuel ; ajoutez `--global` pour l’utiliser dans tous vos projets. Codex stocke les skills du projet dans `.agents/skills/` ; Claude Code utilise `.claude/skills/`.

Appelez la skill dans votre agent :

```text
# Codex
$blueprint4llm Crée un plan visuel pour une file de tâches.

# Claude Code
/blueprint4llm Crée un plan visuel pour une file de tâches.
```

La skill guide l’agent pour rédiger un plan visuel, le valider et le générer, puis examiner chaque visuel. La génération nécessite la CLI `blueprint4llm` et Chrome de Puppeteer ; la section suivante explique comment installer et lancer la CLI.

### Utiliser directement la CLI

Nécessite **Node.js ≥22.13.0**, npm et Chrome de Puppeteer.

```bash
npm install --global blueprint4llm
```

Enregistrez ce contenu dans `plan.md` :

````markdown
# Flux de traitement des demandes

```d2
form: Formulaire de demande
api: Validation de l’API
queue: File de traitement

form -> api
api -> queue
```
````

```bash
blueprint4llm plan.md --serve
```

Ouvrez l’URL affichée, généralement `http://127.0.0.1:8080/`. L’aperçu se met à jour lorsque vous enregistrez le Markdown ou une image locale référencée. La barre d’outils propose le mode sombre et le téléchargement PDF. Arrêtez le serveur avec `Ctrl+C`.

Chrome s’installe normalement automatiquement. Si les scripts d’installation ont été bloqués, installez-le manuellement :

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

## Fonctionnement

![Un plan Markdown est validé puis converti en aperçus interactifs, en documents HTML ou PDF, ou en visuel SVG, PNG ou JPEG autonome](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/workflow.svg)

## Formats

Utilisez des blocs de code délimités avec CommonMark et GitHub Flavored Markdown : texte, tableaux, listes,
liens, images et code. Les blocs de code ordinaires bénéficient de la coloration syntaxique.

| Format     | Délimiteur              | Entrée et prise en charge                                                                                                                                                              |
| ---------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2         | `d2`                    | Le code D2 autonome est généré hors ligne avec WebAssembly intégré. Prend en charge les conteneurs, les connexions, les styles, les tables SQL, les classes UML et les séquences.      |
| Mermaid    | `mermaid`               | Diagrammes de flux, de séquence, de classes, d’états et ER. Utilise une disposition verticale lorsque possible.                                                                        |
| Graphviz   | `graphviz`, `dot`       | Un graphe DOT autonome est converti en SVG dans un worker. Prend en charge les moteurs vérifiés `dot`, `neato`, `circo`, `fdp`, `osage`, `patchwork` et `twopi`.                       |
| PlantUML   | `plantuml`              | Diagrammes standard `@start…` / `@end…`. Moteur local, sans Java, inclusion externe ni requête réseau.                                                                                 |
| draw.io    | `drawio`, `draw.io`     | JSON structuré comprenant des nœuds, des groupes, des libellés et des arêtes. Mise en page automatique ; aucun XML.                                                                    |
| Pencil     | `pencil`, `pen`         | JSONC `.pen` intégré, schéma 2.21. Prend en charge les cadres, groupes, formes, tracés et textes ; pas les images, composants, dégradés ou effets.                                     |
| Balsamiq   | `balsamiq`              | Un mockup Mockups 3 avec les contrôles courants. Conserve les positions et le texte ; ne prend pas en charge `.bmpr`, `.bmml`, les ressources ni les symboles.                         |
| Figma      | `figma`                 | Le JSON REST API est généré localement, ou un frame est exporté via son URL et l’API Figma. Le mode URL nécessite un jeton.                                                            |
| OpenAPI    | `openapi`               | YAML ou JSON OpenAPI 3.1.1 transformé en référence API statique, avec les opérations et les schémas des composants.                                                                    |
| Excalidraw | `excalidraw`            | JSON `.excalidraw` strict v2. Conserve les positions, rotations, groupes, formes, textes et flèches simples ; les éléments non pris en charge sont remplacés par des espaces réservés. |
| Vega-Lite  | `vega-lite`, `vegalite` | Spécifications Vega-Lite 6 avec données intégrées ; générées localement sous forme de SVG statique.                                                                                    |
| ECharts    | `echarts`               | JSON strict selon le profil de graphiques statiques pris en charge ; génération locale en SVG.                                                                                         |

Un exemple visuel de chaque format pris en charge figure ci-dessous. Tous les libellés des images sont en anglais.

| Format                                       |                                                                                                                              Aperçu                                                                                                                              | Format                                         |                                                                                                                                Aperçu                                                                                                                                 |
| -------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [D2](examples/blueprint-d2.md)               | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/d2.svg" alt="Séquence de paiement D2 entre l’application acheteur, la passerelle API et les services de commandes, stock, paiements, événements et e-mail" width="440"> | [Mermaid](examples/blueprint-mermaid.md)       | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/mermaid.svg" alt="Machine à états d’importation avec validation, exécution imbriquée, nouvelles tentatives à délai progressif et gestion des messages en échec" width="440"> |
| [Graphviz](examples/blueprint-graphviz.md)   |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/graphviz.svg" alt="Chaîne d’événements regroupés avec contrôle qualité du schéma, mise en quarantaine, rejeu, stockage et consommateurs" width="440">          | [PlantUML](examples/blueprint-plantuml.md)     |                     <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/plantuml.svg" alt="Réponse aux incidents : détection SLO, chemins de décision, travaux de reprise parallèles et suivi" width="440">                      |
| [draw.io](examples/blueprint-draw.io.md)     |                     <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/drawio.svg" alt="Cycle de vie d’un colis organisé par commerce, paiements, traitement, suivi et assistance client" width="440">                     | [Pencil](examples/blueprint-pencil.md)         |         <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/pencil.svg" alt="Tableau de bord de fiabilité avec navigation, métriques des services, graphique de latence à deux séries et tableau de santé" width="440">          |
| [Balsamiq](examples/blueprint-balsamiq.md)   |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/balsamiq.svg" alt="Tableau de tri du support avec file priorisée et recherche, contexte SLA, ticket sélectionné, attribution et réponse" width="440">          | [Figma](examples/blueprint-figma.md)           |              <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/figma.svg" alt="Itinéraire mobile à Kyoto avec carte de destination, hébergement, nombre de voyageurs, détail du prix et réservation" width="440">              |
| [OpenAPI](examples/blueprint-openapi.md)     |                     <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/openapi.svg" alt="Référence API des opérations de colis : expédition, suivi, pagination et schémas réutilisables" width="440">                      | [Excalidraw](examples/blueprint-excalidraw.md) |                <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/excalidraw.svg" alt="Feuille de route de lancement en trois étapes : découverte, bêta privée, déploiement et jalon de validation" width="440">                |
| [Vega-Lite](examples/blueprint-vega-lite.md) |             <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/vega-lite.svg" alt="Tendances mensuelles de la latence p95 dans deux régions, plages observées et ligne SLO de 200 millisecondes" width="440">              | [ECharts](examples/blueprint-echarts.md)       |                             <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/echarts.svg" alt="Carte thermique comparant la latence API p95 sur sept jours et six plages de trafic" width="440">                              |

### Frames Figma

Le mode JSON nécessite un `DOCUMENT` racine et fonctionne hors ligne sans jeton. Sélectionnez un frame avec `node=12:34` dans les métadonnées du bloc. Le générateur local prend en charge les conteneurs, formes simples, tracés vectoriels, textes et remplissages unis ; utilisez le mode URL pour les dégradés, effets, masques et images.

Le mode URL accepte les liens HTTPS vers des frames `/design/` ou `/file/`. Utilisez un jeton d’accès personnel doté de la permission `file_content:read`. Le jeton est recherché dans cet ordre : `CompileOptions.figmaAccessToken`, `FIGMA_ACCESS_TOKEN`, puis `.env` dans le répertoire de travail actuel. Il est envoyé uniquement à `api.figma.com` ; les SVG exportés sont intégrés au résultat.

## Commandes

| Tâche                   | Commande                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| Aperçu en direct        | `blueprint4llm plan.md --serve --port=8080`                            |
| Validation pour CI      | `blueprint4llm plan.md --check`                                        |
| Validation avec rapport | `blueprint4llm plan.md --check --report-json=diagnostics.json`         |
| Export avec rapport     | `blueprint4llm plan.md --out=plan.html --report-json=diagnostics.json` |
| Export HTML             | `blueprint4llm plan.md --out=plan.html`                                |
| Export avec compteurs   | `blueprint4llm plan.md --out=plan.html --diagnostics-summary`          |
| Export PDF              | `blueprint4llm plan.md --out=plan.pdf --format=pdf`                    |
| Export SVG              | `blueprint4llm plan.md --out=visual.svg --format=svg`                  |
| Export PNG              | `blueprint4llm plan.md --out=visual.png --format=png`                  |
| Export JPEG             | `blueprint4llm plan.md --out=visual.jpeg --format=jpeg`                |

L’export d’image nécessite **exactement un bloc visuel pris en charge** ; l’exemple de démarrage rapide convient. `--out` crée les répertoires parents. Chaque exécution produit un seul format ; HTML est le format par défaut. `--check` valide Markdown, diagrammes et images locales sans écrire de HTML ni de ressources. L’option facultative `--report-json=<file>` écrit atomiquement un rapport JSON UTF-8. Elle fonctionne avec `--check` et les exports ponctuels. Le chemin du rapport doit être distinct des chemins d’entrée et de sortie, y compris leurs alias par lien symbolique. `--report-json` ne peut pas être utilisé avec `--serve`.

Par défaut, les documents générés n’affichent pas le total des erreurs et avertissements. Ajoutez `--diagnostics-summary` aux exports HTML ou PDF et aux aperçus en direct pour l’inclure. Un diagramme en échec affiche son message complet à son emplacement ; le reste du Markdown et les diagrammes valides restent accessibles. Les exports HTML et PDF sont enregistrés même si un diagramme comporte une erreur, puis la commande se termine avec le code `1`. Les exports SVG, PNG et JPEG ne remplacent pas un fichier existant si leur diagramme comporte une erreur. Les avertissements seuls renvoient le code `0`. Les arguments incorrects, notamment les conflits de chemin du rapport, renvoient le code `2`.

Le rapport contient `schemaVersion: 1`, un `status` égal à `ok` ou `error`, des compteurs récapitulatifs et des diagnostics ordonnés. Chaque diagnostic comprend `severity`, un `code` stable, `scope`, le chemin source, éventuellement les coordonnées Markdown et l’identité du diagramme, ainsi que le message complet. Les codes sont `diagram.render`, `diagram.limit`, `diagram.svg`, `renderer.warning`, `document.read`, `document.compile`, `output.render` et `output.write`. L’objet facultatif `outputs` répertorie les fichiers réellement enregistrés par l’exécution. Par exemple, les rapports `--check` ne contiennent pas de champ `outputs`.

Les erreurs fatales de document ou d’export interrompent l’opération concernée. Si un rapport JSON a été demandé et peut encore être écrit, il inclut un diagnostic de document ou de sortie. Si le rapport est impossible à écrire, l’erreur est signalée sur stderr et la commande se termine avec le code `1` ; tout HTML ou PDF déjà enregistré reste disponible. Consultez [`examples/blueprint-diagnostics.md`](examples/blueprint-diagnostics.md), qui montre deux erreurs de diagramme indépendantes séparées par un diagramme valide.

Dans l’aperçu en direct, les diagrammes en échec restent intégrés et le PDF utilise le même document compilé. Le total n’apparaît qu’avec `--diagnostics-summary`. La correction de la source supprime les diagnostics à la compilation suivante. Une erreur fatale de document affiche une page de diagnostic jusqu’à la correction de la source.

## Sortie et limites

| Sujet                  | Comportement                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML                   | Intègre les SVG des diagrammes ; les images locales sont copiées dans un dossier `assets/` adjacent. Ouvrez le résultat directement dans un navigateur.                                                                   |
| PDF                    | Pages A4, polices Noto Sans locales et texte sélectionnable. Les diagrammes D2 larges utilisent des pages paysage. Les images externes doivent être enregistrées localement avant l’export.                               |
| Chemins des images     | Les chemins relatifs sont résolus depuis le fichier Markdown. Les chemins et liens symboliques sortant de son dossier sont refusés.                                                                                       |
| Utilisation hors ligne | Les générateurs locaux n’ont pas besoin du réseau ; les blocs URL Figma récupèrent des données lors de la compilation. Le HTML nécessite une connexion pour les images externes.                                          |
| Sécurité               | Le HTML brut est échappé. Les SVG sont vérifiés pour détecter tout contenu actif et toute ressource externe. Les scripts utilisateur et l’édition graphique ne sont pas pris en charge.                                   |
| Limites du document    | 5 Mio de Markdown, 100 blocs visuels et généralement 256 Kio par bloc.                                                                                                                                                    |
| Limites JSON           | draw.io, Pencil et Figma : 1 Mio et 10 000 cellules/nœuds. Balsamiq : 256 Kio et 3 000 contrôles.                                                                                                                         |
| Limites Vega-Lite      | Source de 256 Kio, 64 niveaux, 50 000 nœuds AST, 10 000 lignes source, 100 vues et transformations développées, 50 000 lignes/éléments calculés et SVG de 4 Mio.                                                          |
| Limites OpenAPI        | Source de 256 Kio, 200 opérations, 500 schémas nommés, 2 000 références, 5 000 lignes de mise en page et SVG de 4 Mio.                                                                                                    |
| Délais                 | Mermaid, PlantUML et Vega-Lite : 30 secondes. Mise en page draw.io : 5 secondes. PDF : 60 secondes.                                                                                                                       |
| Chrome sous Linux      | Nécessite les bibliothèques système de Chrome. Si le démarrage dans le sandbox échoue, une nouvelle tentative est effectuée avec `--no-sandbox`. Définissez `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` pour forcer ce mode. |

## Workflows des agents et éditeurs

| Workflow                                                                             | Configuration                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent de programmation                                                               | Utilisez la skill `blueprint4llm` ; consultez le [Démarrage rapide](#démarrage-rapide) pour l’installation et l’utilisation avec Codex et Claude Code.                                                                |
| [VS Code](https://github.com/evgenyigumnov/blueprint4llm/tree/main/vscode-extension) | Installez un VSIX généré avec `code --install-extension <file.vsix>`. Ouvrez un fichier Markdown et lancez **Blueprint: Open Preview to the Side**. Utilisez **Blueprint: Export Preview as PDF** pour l’enregistrer. |

L’aperçu VS Code compile les modifications non enregistrées après un délai de 200 ms, configurable via `blueprint4llm.preview.debounceMs`. Nécessite VS Code Desktop ≥1.101.0 et Chrome de Puppeteer.

## API programmatique

Installez localement avec `npm install blueprint4llm`, puis utilisez les exports ESM :

```js
import { compileMarkdown, writeBlueprintOutput } from 'blueprint4llm';

const compiled = await compileMarkdown('# Plan\n\nReady for review.', {
  sourceFile: './plan.md',
  includeDiagnosticsSummary: true,
});

await writeBlueprintOutput('./plan.html', {
  html: compiled.html,
  assets: compiled.assets,
});
```

| Export                                        | Fonction                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `compileMarkdown(markdown, options)`          | Renvoie `html`, `title`, `assets`, les anciens tableaux de chaînes `warnings`/`errors` et les `diagnostics` structurés. |
| `renderPdf(compiled, { signal }?)`            | Génère les octets PDF ; transmettez-les comme `pdf` à `writeBlueprintOutput()`.                                         |
| `writeBlueprintOutput(path, options)`         | Écrit HTML et/ou PDF avec les ressources et renvoie les chemins de sortie absolus.                                      |
| `startPreviewServer({ input, port, signal })` | Renvoie `url`, `port` et une méthode asynchrone `close()`.                                                              |

`warnings` et `errors` restent des tableaux de chaînes formatées pour les consommateurs existants. `diagnostics` ajoute des entrées structurées ; cette propriété est facultative dans les types publics afin que les anciennes implémentations du compilateur puissent ne fournir que les tableaux de chaînes. Le compilateur intégré renvoie toujours `diagnostics`. Définissez `includeDiagnosticsSummary: true` dans `CompileOptions` pour ajouter un compteur accessible au HTML généré ; cette option est désactivée par défaut. `startPreviewServer()` accepte la même option.

## Développement

Depuis un clone du dépôt :

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

Lancez directement la CLI avec `node dist/cli.js`, ou utilisez `npm link` pour rendre la commande disponible globalement. Pour créer le VSIX, exécutez `npm install` puis `npm run package` depuis `vscode-extension/`.
