# Risk_v2 - Modifications effectuées

## 📋 Résumé des changements

### 1. ✅ **Limitation du GAMBLE à 1 utilisation par tour (NERFÉ)**

**Fichier modifié:** `renderer.js`

#### Variables ajoutées (lignes 199-202):
```javascript
// === LIMITE GAMBLE PAR TOUR ===
let gambleUsesThisTurn = 0; // Compteur d'utilisations de gamble
const MAX_GAMBLE_PER_TURN = 1; // Maximum 1 gamble par tour (NERFÉ de 2 à 1)
// ===============================
```

#### Modifications dans la fonction `hack()` (lignes 793-803):
- Réinitialisation du compteur à chaque tour
```javascript
// === RÉINITIALISER LE COMPTEUR DE GAMBLE À CHAQUE TOUR ===
gambleUsesThisTurn = 0;
// ==========================================================
```

#### Modifications dans la fonction `buyBonus(3)` (lignes 1280-1328):
- Vérification de la limite avant d'autoriser le gamble
- Incrémentation du compteur après chaque utilisation
- Message d'erreur si limite atteinte: `GAMBLE_LIMIT [1/TURN MAX]`

```javascript
// === VÉRIFIER LA LIMITE DE GAMBLE PAR TOUR ===
if (gambleUsesThisTurn >= MAX_GAMBLE_PER_TURN) {
    updateLog(`GAMBLE_LIMIT [1/TURN MAX]`, 'bad');
    return;
}
// =============================================
```

#### Modifications dans `updateBonusPrices()` (lignes 636-656):
- Affichage du nombre de gambles restants sur le bouton: `[1/1]` ou `[0/1]`
- Désactivation visuelle du bouton quand la limite est atteinte (opacité 0.3, curseur not-allowed)

#### Modifications dans `resetTempBuffs()` (ligne 728):
- Réinitialisation du compteur lors du reset de la session

---

### 2. ✅ **Vérification et correction de l'OVERCLOCK**

**Fichier modifié:** `renderer.js`

#### Variables existantes (lignes 194-196):
```javascript
// === NOUVELLES VARIABLES OVERCLOCK ===
let overclockCooldown = 0; 
let overclockBonusTurns = 0; // Durée du bonus x2
// ===================================
```

#### Application du bonus dans `hack()` (lignes 809-815):
✅ **CONFIRMÉ:** Le multiplicateur est bien augmenté de **200% (x2)** pendant **2 tours**

```javascript
// === APPLICATION DU BONUS OVERCLOCK SUR 2 TOURS ===
if (overclockBonusTurns > 0) { 
    currentMult *= 2;  // ← Multiplication par 2 = +200%
    updateLog(`OVERCLOCK_BONUS [${overclockBonusTurns} LEFT]`, 'info');
    overclockBonusTurns--; 
}
// =================================================
```

**Amélioration:** Affichage du message **avant** la décrémentation pour plus de clarté (affiche "2 LEFT" puis "1 LEFT" au lieu de "1 LEFT" puis "0 LEFT")

#### Achat de l'OVERCLOCK (lignes 1348-1362):
- Coût: 15% de l'argent actuel
- Effet: 
  - ❌ Augmente le risque de 50%
  - ✅ Double le multiplicateur pendant 2 tours (200%)
  - 🔄 Cooldown de 7 tours après utilisation
- Incompatible avec Ghost Shield actif
- Affichage: `OVERCLOCK_COOLDOWN [X]` si en cooldown

---

## 🎮 Comportement en jeu

### GAMBLE (NERFÉ):
1. Au début de chaque tour → Le compteur se réinitialise à **1 gamble disponible**
2. Affichage sur le bouton: `XX.X$ [1/1]` → `XX.X$ [0/1]`
3. Après 1 gamble → Le bouton devient grisé et non cliquable
4. Si tentative de 2ème gamble → Message: `GAMBLE_LIMIT [1/TURN MAX]`
5. Prochain tour → Le compteur repart à 1

**⚠️ NERF 1:** Réduit de 2 à **1 utilisation maximum par tour** pour équilibrer le gameplay

**⚠️ NERF 2:** Ajout d'un résultat négatif **+10% RISK** (15% de chances)

**⚠️ NERF 3:** PURGED réduit à **1%** (ultra rare), GAMBLE_LOSS augmenté à **20%**

**Probabilités finales du GAMBLE:**
- 🎰 **JACKPOT** (x2 argent + -15% risk) : **25% + algo.lvl** (~25-55%)
- ✅ **RISK_REDUCED** (-20% risk) : **30%**
- ⚠️ **RISK_PENALTY** (+10% risk) : **15%** ← NOUVEAU (NERF #2)
- ❌ **GAMBLE_LOSS** (rien) : **20%** ← AUGMENTÉ (NERF #3)
- 🌟 **PURGED** (risk = 0) : **1%** ← ULTRA RARE (NERF #3)
- 💀 **BUSTED** (game over ou ghost shield) : **9%** (ou 5-34% selon algo.lvl)

### OVERCLOCK:
1. Achat → Active le bonus pendant 2 tours + Cooldown de 7 tours
2. Tour 1 → `OVERCLOCK_BONUS [2 LEFT]` + multiplicateur x2
3. Tour 2 → `OVERCLOCK_BONUS [1 LEFT]` + multiplicateur x2
4. Tour 3 à 9 → `OVERCLOCK_COOLDOWN [5]` ... `[1]`
5. Tour 10 → Peut être racheté

---

## 📦 Fichiers modifiés

- ✅ `renderer.js` - Fichier principal avec toute la logique du jeu
- ℹ️ `main.js` - Inchangé (fichier Electron)
- ℹ️ `index.html` - Inchangé (structure HTML)
- ℹ️ `package.json` - Inchangé (configuration)
- ℹ️ `package-lock.json` - Inchangé (dépendances)

---

## 🚀 Pour tester

1. Lancer le jeu avec `npm start`
2. Commencer une partie
3. **Test GAMBLE:**
   - Gagner de l'argent
   - Utiliser GAMBLE **1 fois**
   - Vérifier que le **2ème clic est bloqué**
   - Faire un hack pour passer au tour suivant
   - Vérifier que **1 gamble est à nouveau disponible**

4. **Test OVERCLOCK:**
   - Acheter OVERCLOCK
   - Observer le multiplicateur doublé pendant 2 tours
   - Vérifier le cooldown de 7 tours
   - Confirmer l'incompatibilité avec Ghost Shield

---

## ✨ Améliorations apportées

- 🎯 **Équilibrage du gameplay** avec limitation du gamble à **1 utilisation par tour** (NERF #1)
- ⚠️ **Ajout de risque** au gamble avec 15% de chance de **+10% risk** (NERF #2)
- 💀 **Rareté du PURGED** : Réduit à **1%** (ultra rare), GAMBLE_LOSS augmenté à **20%** (NERF #3)
- 📊 **Feedback visuel clair** avec compteur affiché
- 🔒 **Prévention des abus** avec désactivation du bouton
- 🎮 **Meilleure expérience utilisateur** avec messages explicites
- ⚡ **Clarté des messages** pour l'overclock
- ⚖️ **Balance du jeu** : Le gamble est maintenant un choix stratégique unique et **risqué** par tour

### 🎲 Triple NERF du GAMBLE expliqué :

**Avant les modifications :**
- Utilisations : Illimitées par tour
- Résultats : Seulement des gains ou neutre (pas de malus)
- PURGED : 10% (sauvegarde facile)
- GAMBLE_LOSS : 30%
- BUSTED : 5%
- Stratégie : Spam sans réflexion

**Après NERF #1 :**
- Utilisations : **1 seule par tour**
- Impact : Force un choix stratégique du bon moment

**Après NERF #2 :**
- Nouveau résultat : **RISK_PENALTY (+10% risk)** avec 15% de chances
- Impact : Le gamble peut maintenant vous punir directement

**Après NERF #3 (ajusté v1.4) :**
- PURGED : **1%** (de 10% à 1%) - Ultra rare, ne comptez pas dessus !
- GAMBLE_LOSS : **20%** (de 30% à 15%, puis à 20%) - 1 chance sur 5 de ne rien gagner
- BUSTED : **~5-9%** (selon algo.lvl) - Risque modéré mais présent
- Impact : Le PURGED devient un miracle, les échecs sont plus fréquents

**Résultat final :** Le gamble est devenu un outil tactique risqué, limité à 1 utilisation par tour, avec un malus possible et très peu de chances d'obtenir le PURGED miraculeux. À utiliser stratégiquement !

---

**Date:** 08/02/2026
**Version:** Risk_v2 - Patch Balance v1.4 (GAMBLE TRIPLE NERF - AJUSTÉ)

**Changelog:**
- v1.4: Ajustement final : BUSTED à 5%, GAMBLE_LOSS à 20% (plus équilibré)
- v1.3: PURGED réduit à 1% (ultra rare), BUSTED augmenté à 14%
- v1.2: Ajout de RISK_PENALTY (+10% risk, 15% chance) au gamble
- v1.1: Limitation du gamble à 1 utilisation par tour
- v1.0: Vérification overclock et système de limite
