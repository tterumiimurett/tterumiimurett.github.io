// Small, scalable silhouettes based on the two pairs supplied by the author.
const silhouettes={
  rounded:{
    male:{color:'#455262',body:'M7 18C7 11 25 11 25 18V34C25 38 19 38 19 34V30C19 27 13 27 13 30V34C13 38 7 38 7 34Z'},
    female:{color:'#D4A09A',body:'M16 12C11 12 7 24 5 28Q4 30 7 30H14V36C14 39 18 39 18 36V30H25Q28 30 27 28C25 24 21 12 16 12Z'}
  },
  organic:{
    male:{color:'#777A68',body:'M7 18C7 11 25 11 25 18V27H21L19 38H13L11 27H7Z'},
    female:{color:'#E2CCB6',body:'M16 12C13 12 12 16 12 20C12 24 6 28 6 34C6 38 12 35 15 36C18 36 17 40 21 38L29 33C26 27 19 24 19 21C19 18 22 13 16 12Z'}
  }
};
export function voiceIcon(gender='female',variant='hybrid') {
  const key=gender==='male'?'male':'female';
  const shape=(silhouettes[variant]||silhouettes.organic)[key];
  const color=variant==='hybrid'?silhouettes.rounded[key].color:shape.color;
  return `<svg class="voice-silhouette" viewBox="0 0 32 40" width="24" height="29" aria-hidden="true"><g fill="${color}"><circle cx="16" cy="5.5" r="4.2"/><path d="${shape.body}"/></g></svg>`;
}
