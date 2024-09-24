

# Guide d'Installation de MongoDB

## Sommaire
- [Introduction](#introduction)
- [Prérequis](#prérequis)
- [Installation sur Windows](#installation-sur-windows)
- [Installation sur macOS](#installation-sur-macos)
- [Installation sur Linux](#installation-sur-linux)
- [Configuration de MongoDB](#configuration-de-mongodb)
- [Démarrer MongoDB](#démarrer-mongodb)
- [Utilisation de MongoDB](#utilisation-de-mongodb)
- [Conclusion](#conclusion)

## Introduction
MongoDB est une base de données NoSQL orientée documents, conçue pour stocker et gérer des données non structurées. Ce guide vous montrera comment installer MongoDB sur différentes plateformes.

## Prérequis
- Accès à Internet pour télécharger MongoDB.
- Un terminal ou une interface de ligne de commande.
- Droits d'administrateur pour l'installation.

## Installation sur Windows

1. **Télécharger MongoDB :**
   - Allez sur le site officiel de [MongoDB](https://www.mongodb.com/try/download/community).
   - Choisissez la version Windows et téléchargez le fichier `.msi`.

2. **Installer MongoDB :**
   - Double-cliquez sur le fichier `.msi` téléchargé.
   - Suivez les instructions de l'assistant d'installation.
   - Assurez-vous de sélectionner l'option "Complete" lors de l'installation.

3. **Configurer le chemin :**
   - Ajoutez le chemin de MongoDB (par défaut `C:\Program Files\MongoDB\Server\<version>\bin`) à la variable d'environnement `PATH`.

## Installation sur macOS

1. **Installer Homebrew :** (si ce n'est pas déjà fait)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Installer MongoDB :**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

## Installation sur Linux

### Pour Ubuntu :

1. **Importer la clé publique utilisée par le système de gestion de paquets :**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-<version>.asc | sudo apt-key add -
   ```

2. **Créer un fichier de liste pour MongoDB :**
   ```bash
   echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu focal/multiverse amd64 Packages" | sudo tee /etc/apt/sources.list.d/mongodb-org-<version>.list
   ```

3. **Mettre à jour le système :**
   ```bash
   sudo apt update
   ```

4. **Installer MongoDB :**
   ```bash
   sudo apt install -y mongodb-org
   ```

## Configuration de MongoDB

1. **Créer un répertoire de données :**
   Par défaut, MongoDB utilise `/data/db` comme répertoire de données. Créez ce répertoire si nécessaire :
   ```bash
   sudo mkdir -p /data/db
   sudo chown `id -u` /data/db
   ```

## Démarrer MongoDB

- **Sur Windows :** Utilisez le terminal PowerShell ou l'invite de commandes pour démarrer MongoDB.
  ```bash
  mongod
  ```

- **Sur macOS et Linux :** Démarrez MongoDB en utilisant la commande suivante :
  ```bash
  mongod --dbpath /data/db
  ```

## Utilisation de MongoDB

1. **Lancer le client MongoDB :**
   ```bash
   mongo
   ```

2. **Créer une base de données :**
   ```javascript
   use nom_de_la_base
   ```

3. **Insérer un document :**
   ```javascript
   db.nom_de_la_collection.insert({ clé: "valeur" })
   ```

## Conclusion
Vous avez maintenant installé et configuré MongoDB sur votre machine. Vous pouvez commencer à l'utiliser pour vos projets de développement. Pour plus d'informations, consultez la [documentation officielle de MongoDB](https://docs.mongodb.com/manual/).

---

