[tiếng Việt](README.md) · [English](README.en.md) · [简体中文](README.zh.md) · **Français**

# WENKER - fournisseur de modèles VS Code

Intègre **tous les modèles de WENKER Router** (`http://localhost:3600`) directement
dans la liste de modèles de VS Code : Chat, Copilot Edit, Agent, et tous les
partenaires qui utilisent le sélecteur de modèles. C'est l'approche « B » : au lieu
de réinventer un IDE, on s'appuie sur l'API officielle de VS Code pour en faire un
vrai fournisseur de modèles.

## Des modèles dès le premier lancement

1. Démarrer le routeur : `start.bat` ou `node server/index.js`.
2. Installer cette extension (le fichier `.vsix`).
3. Ouvrir le panneau Chat → cliquer sur le sélecteur de modèles → le groupe
   **WENKER (local router)**.

Aucune configuration supplémentaire n'est nécessaire. Par défaut, l'extension
n'affiche que les **modèles gratuits sans clé API**, c'est-à-dire qu'on peut choisir
et lancer immédiatement.

## Installation depuis un fichier .vsix

```
code --install-extension wenker-0.1.1.vsix --force
```

Ou dans VS Code : `Ctrl+Shift+P` → **Extensions: Install from VSIX...**

### Auto-test : VS Code voit-il vraiment les modèles ?

`Ctrl+Shift+P` → **WENKER : Auto-test — combien de modèles VS Code voit-il ?**
Cette commande appelle `vscode.lm.selectChatModels({vendor:"wenker"})` — elle
interroge **VS Code lui-même**, et non l'extension — puis ouvre un tableau markdown
listant chaque id reçu par le sélecteur de modèles. Si le nombre d'id est inférieur
au nombre de modèles générés par l'extension, cela signifie que VS Code en ignore
à cause d'identifiants en double.

## Configuration

| Paramètre | Valeur par défaut | Signification |
|---|---|---|
| `wenker.baseUrl` | `http://localhost:3600/v1` | URL de base du routeur. À changer s'il tourne sur un autre port/machine. |
| `wenker.modelFilter` | `free` | `no-key` = uniquement les modèles sans clé API · `free` = tous les modèles gratuits · `all` = la totalité |
| `wenker.maxOutputTokens` | `4096` | Nombre maximum de tokens de sortie déclaré à VS Code |
| `wenker.maxInputTokensCap` | `128000` | Plafond de contexte réellement utilisé dans VS Code (voir note ci-dessous) |
| `wenker.requestTimeoutMs` | `120000` | Délai d'attente maximum par requête |
| `wenker.adminKey` | `""` | Clé API au rôle admin, nécessaire uniquement pour les commandes d'administration depuis une autre machine |

### À propos de `maxInputTokensCap`

Certaines sources gratuites déclarent un contexte allant jusqu'à **1 000 000 de
tokens** (par exemple `wenker-gemini-2.5-free`), mais en réalité beaucoup d'entre
elles ne peuvent pas réellement servir jusque-là. VS Code utilise `maxInputTokens`
pour décider comment tronquer l'historique du chat, donc déclarer une valeur trop
élevée fait perdre du contenu **en silence, sans erreur**. C'est pourquoi
l'extension plafonne la valeur à `maxInputTokensCap` (128K par défaut) et l'indique
clairement dans l'infobulle quand le routeur déclare plus. Ne l'augmentez que si
vous êtes certain que la source tient réellement cette taille.

## Commandes

| Commande | Effet |
|---|---|
| `WENKER : Recharger la liste des modèles` | Rappel de `/v1/models`, demande à VS Code de redessiner la liste |
| `WENKER : Vérifier connexion + routage` | Ouvre un tableau de rapport : serveur vivant ou non, nombre de modèles, groupes sans clé, sources actives selon le probe |
| `WENKER : Installer un fichier .addon` | Choisit un fichier `.addon` → appelle `POST /api/addons/install` |
| `WENKER : Lister les add-on installés` | Ouvre le tableau des add-on présents sur le routeur |
| `WENKER : Ouvrir le dashboard + Playground` | Ouvre `http://localhost:3600` dans le navigateur |
| `WENKER : Auto-test — combien de modèles VS Code voit-il ?` | Interroge directement `vscode.lm.selectChatModels()` puis ouvre un tableau d'id, pour détecter les modèles silencieusement ignorés par VS Code |

## Fonctionnement (et pourquoi aucune configuration n'est requise)

L'extension ne conserve aucune liste statique de modèles. À chaque fois que VS Code
interroge, elle appelle `GET /v1/models` du routeur puis filtre selon `modelFilter`.
Dès que le routeur ajoute un fournisseur ou un modèle, le côté extension le voit
immédiatement ; il suffit de lancer `Recharger la liste des modèles`.

Elle utilise `vscode.lm.registerLanguageModelChatProvider` et le point de
contribution `languageModelChatProviders` — une API **stable**, pas une API
proposée, donc aucun mécanisme d'adaptation expérimental n'a besoin d'être activé.

## Limites réelles (sans exagération)

- **Les sources gratuites anonymes épuisent leur budget** : pollinations (le groupe
  `wenker-*`) renvoie `402 Payment Required` / « reached its budget » quand le
  quota est atteint. C'est une limite amont, pas un bug de l'extension. Utiliser
  `WENKER : Vérifier connexion` pour trouver les sources actives, ou ajouter soi-même
  une clé gratuite pour Groq/Gemini/OpenRouter... via le dashboard, puis passer
  `modelFilter` sur `all`.
- **Pas d'images ni de tool calling** : `capabilities.imageInput` et `toolCalling`
  sont fixés à `false`, car le routeur ne peut pas garantir un function-calling
  complet sur 181 sources différentes. Déclarer `true` ferait envoyer par VS Code un
  format que l'amont ne saurait pas lire.
- **Estimation des tokens imprécise** : `provideTokenCount` utilise une approximation
  d'environ 4 caractères par token. Le routeur n'exécute pas le tokenizer propre à
  chaque source amont.
- **Installation d'add-on à distance nécessite une clé admin** : depuis la machine
  locale, le guard laisse passer ; depuis une autre machine, il faut envoyer
  `x-wenker-admin-key` (l'extension la demande au besoin).

## Pourquoi certains modèles s'appellent `provider/nom-du-modele`

VS Code identifie chaque modèle par une chaîne `vendor/id` (ou `vendor/groupe/id`) et
**ignore silencieusement** tout modèle dont l'identifiant est en double avec un modèle
déjà enregistré — le log de la fenêtre affiche
`[LM] Model wenker/default is already registered. Skipping.`.

Or le routeur compte jusqu'à 6 fournisseurs locaux (vllm, sglang, aphrodite,
xinference, openwebui-proxy, openllm/llamacpp) qui nomment tous leur modèle
`default`. En gardant le nom nu, un seul des 6 modèles apparaîtrait dans le
sélecteur. C'est pourquoi l'extension renomme automatiquement les modèles en
conflit en `provider/id`, par exemple `llamacpp/default`.

Deux points à dire franchement :

- Le routeur accepte les noms d'identification en `provider/id` (`POST
  /v1/chat/completions` renvoie 200 pour `wenker-cloud/wenker-deepseek-r1-free`).
- Le groupe `*/default` n'est **présent dans la liste** que pour la complétude ; un
  appel réel échouera si vous ne faites pas tourner ce runtime sur
  `localhost:8000/4000/...`. C'est un fait, pas une erreur de routage.
