export const T = {
  // Shared DentVision neutral foundation. Legacy token names are retained for compatibility.
  bg:       "#F6F7F7",
  navy:     "#FFFFFF",
  navyL:    "#F0F2F1",
  card:     "#FFFFFF",
  cardHov:  "#F6F7F7",
  gold:     "#A47B35",
  goldL:    "#D3AA68",
  goldDim:  "#8B6A2F",
  border:   "rgba(23,25,24,0.08)",
  borderSub:"rgba(23,25,24,0.08)",
  white:    "#171918",
  slate:    "#6F7673",
  slateL:   "#A0A6A3",
  emerald:  "#2F7D5A",
  ruby:     "#B54747",
  amber:    "#9A6B18",
  sapphire: "#3D6F9E",
  purple:   "#6F657F",
  cyan:     "#3D7F86",
  pink:     "#8A6170",
  teal:     "#4F776E",
  orange:   "#9A6A3A",
} as const;

export const COLORS = {
  primary: T.gold,
  secondary: T.sapphire,
  success: T.emerald,
  danger: T.ruby,
  warning: T.amber,
  info: T.sapphire,
  patientNew: T.teal,
  patientRegular: T.slate,
  patientVip: T.gold,
  appointmentConfirmed: T.emerald,
  appointmentPending: T.amber,
  appointmentCancelled: T.ruby,
  appointmentCompleted: T.sapphire,
} as const;

export const GLOBAL_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',system-ui,sans-serif;background:${T.bg};color:${T.white};-webkit-font-smoothing:antialiased;}
  input,select,textarea{font-family:inherit;background:${T.card};border:1px solid ${T.border};color:${T.white};border-radius:8px;padding:10px 13px;font-size:13px;width:100%;outline:none;transition:border-color .2s,box-shadow .2s;}
  input:focus,select:focus,textarea:focus{border-color:${T.gold};box-shadow:0 0 0 2px rgba(164,123,53,.12);}
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
