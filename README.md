# 📦 Evotalks Backup Manager

Gerenciador de Backups para Evotalks - Uma aplicação desktop robusta para gerenciar e restaurar backups de chats.

## 🎯 Sobre o Projeto

O **Evotalks Backup Manager** é uma aplicação desktop desenvolvida com tecnologias modernas para facilitar o gerenciamento, armazenamento e restauração de backups de conversas do Evotalks. A aplicação oferece uma interface intuitiva e responsiva para controlar todos os seus backups de forma segura e eficiente.

## 🚀 Stack

### Frontend
- **React** (v18.3.1) - Biblioteca JavaScript para construção de interfaces de usuário
- **Next.js** (v14.2.32) - Framework React com suporte a SSR e otimizações
- **Tailwind CSS** (v3.4.17) - Framework CSS utilitário para estilização
- **Lucide React** (v0.544.0) - Biblioteca de ícones SVG

### Desktop
- **Electron** (v34.0.0) - Framework para construir aplicações desktop multiplataforma
- **Nextron** (v9.5.0) - Integração entre Next.js e Electron

### Backend/Utilitários
- **Node.js** - Ambiente de execução JavaScript
- **Electron Store** (v8.2.0) - Armazenamento persistente de dados
- **Electron Serve** (v1.3.0) - Servidor HTTP para Electron
- **Node Schedule** (v2.1.1) - Agendador de tarefas
- **ADM-ZIP** (v0.5.16) - Manipulação de arquivos ZIP
- **Node Fetch** (v3.3.2) - API Fetch para Node.js (requisições HTTP)
- **Tailwind Merge** (v3.4.0) - Utilitário para mesclar classes Tailwind CSS

### Ferramentas de Desenvolvimento
- **ESLint** (v9.39.1) - Linter para JavaScript
- **Prettier** (v3.0.0) - Formatador de código
- **PostCSS** (v8.5.6) - Processador de CSS
- **Autoprefixer** (v10.4.21) - Adiciona prefixos de vendor ao CSS

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (v18.0.0 ou superior)
  - [Download Node.js](https://nodejs.org/)
  - Verifique a instalação: `node --version`

- **npm** (v9.0.0 ou superior)
  - Vem junto com o Node.js
  - Verifique a instalação: `npm --version`

- **Git**
  - [Download Git](https://git-scm.com/)
  - Verifique a instalação: `git --version`

## 🔧 Como Rodar Localmente

### 1. Clonar o Repositório

```bash
git clone https://github.com/matheusmendescosta/backup-manager-evotalks
cd backup-manager-evotalks
```

### 2. Instalar as Dependências

```bash
npm install
```

Isso irá instalar todas as dependências listadas no `package.json`.

### 3. Rodar em Desenvolvimento

```bash
npm run dev
```

A aplicação irá:
- Iniciar o servidor Next.js na porta 8888
- Abrir a janela do Electron automaticamente
- Hot reload habilitado para mudanças rápidas

### 4. Compilar para Produção

```bash
npm run build
```

Isso irá:
- Fazer build do Next.js
- Preparar os arquivos para o Electron
- Gerar os executáveis da aplicação

## 📦 Scripts Disponíveis

```bash
npm run dev              # Rodar em desenvolvimento
npm run build            # Compilar para produção
npm run lint             # Executar ESLint e corrigir automaticamente
npm run lint:check       # Apenas verificar erros do ESLint
```

### Exemplos de Uso

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Verificar erros de código
npm run lint:check

# Corrigir erros de código automaticamente
npm run lint
```

## 📁 Estrutura do Projeto

```
backup-manager-evotalks/
├── main/                      # Processo principal do Electron
│   └── background.js          # Configuração do Electron
├── renderer/                  # Frontend Next.js
│   ├── pages/                 # Páginas da aplicação
│   │   ├── index.jsx         # Dashboard
│   │   ├── download-chats.jsx # Gerenciar downloads
│   │   ├── settings.jsx      # Configurações
│   │   └── chats/[id].jsx    # Visualizar chat
│   ├── components/            # Componentes React
│   │   ├── ChatTable.jsx      # Tabela de chats
│   │   ├── StatsCards.jsx     # Cards de estatísticas
│   │   └── Pagination.jsx     # Paginação
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-pagination.js  # Hook de paginação
│   │   └── use-filters.js     # Hook de filtros
│   ├── utils/                 # Funções utilitárias
│   │   └── utils.js           # Funções compartilhadas
│   ├── styles/                # Estilos globais
│   └── next.config.js         # Configuração do Next.js
├── app/                       # Arquivos compilados do Electron
├── eslint.config.js           # Configuração do ESLint
├── .prettierrc                 # Configuração do Prettier
├── tailwind.config.js          # Configuração do Tailwind CSS
├── postcss.config.js           # Configuração do PostCSS
└── package.json               # Dependências do projeto
```

## 🎨 Funcionalidades Principais

- ✅ **Dashboard** - Visualizar estatísticas gerais de backups
- ✅ **Gerenciar Downloads** - Listar, filtrar e buscar chats
- ✅ **Paginação** - Navegar entre páginas de resultados
- ✅ **Filtros Avançados** - Filtrar por data, nome ou ID
- ✅ **Visualizar Chats** - Abrir e visualizar conversas completas
- ✅ **Configurações** - Ajustar preferências e agendamentos
- ✅ **Backup Automático** - Agendar backups para horários específicos
- ✅ **Estatísticas** - Monitorar último backup e total de downloads

## 🔒 Configuração de Desenvolvimento

### ESLint e Prettier

O projeto usa ESLint para garantir qualidade de código e Prettier para formatação automática.

```bash
# Verificar erros
npm run lint:check

# Corrigir automaticamente
npm run lint
```

Configurações em:
- `eslint.config.js` - Regras do ESLint
- `.prettierrc` - Regras de formatação

### VS Code Extensions Recomendadas

- **ESLint** - Identificar erros de código em tempo real
- **Prettier - Code formatter** - Formatação automática
- **Tailwind CSS IntelliSense** - Autocompletar Tailwind
- **Material Icon Theme** - Ícones para arquivos

## 🛠️ Solução de Problemas

### Erro: "Cannot find module"
```bash
# Limpe as dependências e reinstale
rm -r node_modules package-lock.json
npm install
```

### Erro: "Port 8888 already in use"
```bash
# Use outra porta
PORT=3000 npm run dev
```

### Electron não abre
```bash
# Limpe o cache do Electron
rm -r node_modules/.cache
npm run dev
```

## 📝 Commits e Código

O projeto segue padrões de qualidade:
- ✅ ESLint para validação de código
- ✅ Prettier para formatação consistente
- ✅ Padrão de nomenclatura React para componentes
- ✅ Documentação JSDoc para funções

## 🚀 Deploy

Para compilar a aplicação para distribuição:

```bash
# Build de produção
npm run build

# Executáveis estarão em:
# - dist/Evotalks Backup Manager Setup 1.0.6.exe (Windows)
# - dist/Evotalks Backup Manager 1.0.6.dmg (macOS)
# - dist/evotalks-backup-manager-1.0.6.AppImage (Linux)
```

## 📄 Licença

Este projeto é propriedade da Evotalks.

## 👨‍💻 Autor

- **Matheus Mendes** - [matheus.mendes@evotalks.com.br](mailto:matheus.mendes@evotalks.com.br)

## 📞 Suporte

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório.

## 🔄 Changelog

### v1.0.6 (Atual)
- ✨ Refatoração de componentes
- ✨ Implementação de hooks customizados
- ✨ Melhorias na paginação e filtros
- ✨ Adicionado suporte a requisições HTTP com Node Fetch
- 🐛 Correções de bugs menores
- 📝 Documentação melhorada

---