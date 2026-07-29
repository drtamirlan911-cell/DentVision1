export const T = {
  bg:       "#080F1A",
  navy:     "#0D1B2E",
  navyL:    "#132540",
  card:     "rgba(255,255,255,0.035)",
  cardHov:  "rgba(255,255,255,0.06)",
  gold:     "#C9A96E",
  goldL:    "#E2C898",
  goldDim:  "#8B6F3E",
  border:   "rgba(201,169,110,0.15)",
  borderSub:"rgba(255,255,255,0.06)",
  white:    "#FFFFFF",
  slate:    "#7A8899",
  slateL:   "#B0BEC5",
  emerald:  "#27AE60",
  ruby:     "#E74C3C",
  amber:    "#F39C12",
  sapphire: "#2980B9",
  purple:   "#8E44AD",
  cyan:     "#00BCD4",
  pink:     "#E91E8C",
  teal:     "#009688",
  orange:   "#FF5722",
} as const;

export const COLORS = {
  primary: T.gold,
  secondary: T.sapphire,
  success: T.emerald,
  danger: T.ruby,
  warning: T.amber,
  info: T.cyan,
  patientNew: T.pink,
  patientRegular: T.teal,
  patientVip: T.purple,
  appointmentConfirmed: T.emerald,
  appointmentPending: T.amber,
  appointmentCancelled: T.ruby,
  appointmentCompleted: T.cyan,
} as const;

export const GLOBAL_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',system-ui,sans-serif;background:${T.bg};color:${T.white};-webkit-font-smoothing:antialiased;}
  input,select,textarea{font-family:inherit;background:rgba(255,255,255,0.05);border:1px solid ${T.border};color:${T.white};border-radius:8px;padding:10px 13px;font-size:13px;width:100%;outline:none;transition:border-color .2s;}
  input:focus,select:focus,textarea:focus{border-color:${T.gold};}
  input::placeholder,textarea::placeholder{color:${T.slate};}
  select option{background:${T.navy};color:${T.white};}
  button{cursor:pointer;font-family:inherit;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:${T.goldDim};border-radius:4px;}
  @media(max-width:768px){
    .sidebar{display:none!important;}
    .mobile-nav{display:flex!important;}
    .main-content{padding:16px!important;}
    .page-header{flex-direction:column!important;gap:10px!important;align-items:flex-start!important;}
    .grid-2{grid-template-columns:1fr!important;}
    .grid-3{grid-template-columns:1fr 1fr!important;}
    .hide-mobile{display:none!important;}
    .chat-sidebar{display:none!important;}
  }
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes pulse{0%,80%,100%{transform:scale(.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes slideIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
  .fade-in{animation:fadeIn .25s ease;}
  .slide-in{animation:slideIn .3s ease;}
`;
