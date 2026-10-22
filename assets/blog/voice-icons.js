// Final selection: version-one silhouettes with version-two colors.
const icons={
  male:{color:'#455262',path:'M7 18C7 11 25 11 25 18V27H21L19 38H13L11 27H7Z'},
  female:{color:'#D4A09A',path:'M16 12C13 12 12 16 12 20C12 24 6 28 6 34C6 38 12 35 15 36C18 36 17 40 21 38L29 33C26 27 19 24 19 21C19 18 22 13 16 12Z'}
};
export function voiceIcon(gender='female') {
  const icon=icons[gender==='male'?'male':'female'];
  return `<svg class="voice-silhouette" viewBox="0 0 32 40" width="24" height="29" aria-hidden="true"><g fill="${icon.color}"><circle cx="16" cy="5.5" r="4.2"/><path d="${icon.path}"/></g></svg>`;
}
