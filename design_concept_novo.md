# Conceito de Design - Sistema MRP/PCP (Novo Frontend)

## Problemas Identificados no Frontend Atual
- Botões brancos sem visibilidade
- Fundo branco que compromete a legibilidade
- Falta de contraste adequado
- Interface não profissional
- Problemas de usabilidade

## Novo Conceito de Design

### Paleta de Cores Profissional
**Cores Principais:**
- **Fundo Principal**: `#1a1a1a` (Preto suave)
- **Fundo Secundário**: `#2d2d2d` (Cinza escuro)
- **Fundo de Cards**: `#3a3a3a` (Cinza médio)

**Cores de Destaque:**
- **Azul Principal**: `#0074D9` (Botões primários)
- **Verde**: `#3D9970` (Sucesso/Confirmação)
- **Amarelo**: `#FFDC00` (Alertas/Avisos)
- **Azul Claro**: `#7FDBFF` (Links/Informações)
- **Navy**: `#001f3f` (Elementos de apoio)

**Cores de Texto:**
- **Texto Principal**: `#ffffff` (Branco)
- **Texto Secundário**: `#cccccc` (Cinza claro)
- **Texto Desabilitado**: `#888888` (Cinza médio)

### Princípios de Design

#### 1. Contraste Alto
- Garantir legibilidade em todos os elementos
- Botões com cores vibrantes sobre fundo escuro
- Texto branco sobre fundos escuros

#### 2. Hierarquia Visual Clara
- Títulos em tamanhos distintos
- Uso de cores para destacar elementos importantes
- Espaçamento consistente

#### 3. Interatividade
- Hover effects em todos os elementos clicáveis
- Transições suaves (0.3s)
- Feedback visual imediato

#### 4. Responsividade
- Layout adaptável para diferentes telas
- Grid system flexível
- Componentes escaláveis

### Componentes Principais

#### 1. Sidebar
- Fundo: `#2d2d2d`
- Itens ativos: `#0074D9`
- Hover: `#3a3a3a`
- Ícones: `#ffffff`

#### 2. Cards/Painéis
- Fundo: `#3a3a3a`
- Borda: `#4a4a4a`
- Sombra sutil
- Bordas arredondadas (8px)

#### 3. Botões
- **Primário**: `#0074D9` com hover `#005bb5`
- **Secundário**: `#3D9970` com hover `#2d7a5a`
- **Alerta**: `#FFDC00` com hover `#e6c400`
- **Neutro**: `#4a4a4a` com hover `#5a5a5a`

#### 4. Formulários
- Campos: `#2d2d2d` com borda `#4a4a4a`
- Focus: borda `#0074D9`
- Labels: `#cccccc`
- Placeholders: `#888888`

#### 5. Tabelas
- Cabeçalho: `#2d2d2d`
- Linhas alternadas: `#3a3a3a` / `#2d2d2d`
- Hover: `#4a4a4a`
- Bordas: `#4a4a4a`

### Layout Structure

#### 1. Header
- Logo e título do sistema
- Navegação principal
- Indicadores de status

#### 2. Sidebar
- Menu de navegação vertical
- Ícones + texto
- Estado ativo/inativo

#### 3. Main Content
- Área principal de conteúdo
- Cards organizados em grid
- Seções bem definidas

#### 4. Footer
- Informações do sistema
- Links úteis

### Tipografia
- **Fonte Principal**: Inter, system-ui, sans-serif
- **Tamanhos**:
  - H1: 2.5rem (40px)
  - H2: 2rem (32px)
  - H3: 1.5rem (24px)
  - Body: 1rem (16px)
  - Small: 0.875rem (14px)

### Animações e Transições
- **Duração padrão**: 0.3s
- **Easing**: ease-in-out
- **Hover effects**: scale(1.02) para cards
- **Loading states**: spinner animado

### Acessibilidade
- Contraste mínimo 4.5:1
- Foco visível em todos os elementos
- Textos alternativos para ícones
- Navegação por teclado

## Implementação Técnica

### Tecnologias
- HTML5 semântico
- CSS3 com Flexbox/Grid
- JavaScript ES6+
- Tailwind CSS para utilitários

### Estrutura de Arquivos
```
src/static/
├── css/
│   ├── main.css (estilos principais)
│   └── components.css (componentes)
├── js/
│   ├── main.js (funcionalidades principais)
│   └── components.js (componentes JS)
└── index_redesigned.html (nova interface)
```

### Responsividade
- Mobile first approach
- Breakpoints: 640px, 768px, 1024px, 1280px
- Grid adaptável
- Menu colapsável em mobile

## Resultado Esperado
- Interface profissional e moderna
- Excelente contraste e legibilidade
- Navegação intuitiva
- Performance otimizada
- Experiência do usuário superior

