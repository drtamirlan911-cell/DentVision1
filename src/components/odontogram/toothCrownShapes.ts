import type { RootPattern } from './toothMorphology'

function crownPath(pattern: RootPattern): string {
  switch (pattern) {
    case 'incisor':
      return 'M15.6 26 C14.6 32 13.4 40 13.2 46 C13.2 52 15.4 57.4 20 57.6 C24.6 57.4 26.8 52 26.8 46 C26.6 40 25.4 32 24.4 26 Z'
    case 'canine':
      return 'M15.4 26 C14.4 32 13 40 12.8 45.4 C12.8 50.4 14.6 54 17.2 56.2 C18.4 57.2 19.4 58.8 20 60.4 C20.6 58.8 21.6 57.2 22.8 56.2 C25.4 54 27.2 50.4 27.2 45.4 C27 40 25.6 32 24.6 26 Z'
    case 'premolar1':
    case 'premolar2':
      return 'M14.2 26 C13 32 11 38 10.8 43.4 C10.8 49 13 54.4 16.6 56 C18.2 56.6 19.4 54.4 20 52.4 C20.6 54.4 21.8 56.6 23.4 56 C27 54.4 29.2 49 29.2 43.4 C29 38 27 32 25.8 26 Z'
    case 'molarUpper':
    case 'molarLower':
    default:
      return 'M9 26 C7 32 5.6 38 5.6 43 C5.6 50 8 56.4 12.6 58 C14.6 58.6 16.4 56.4 17.4 54.4 C18.2 52.9 21.8 52.9 22.6 54.4 C23.6 56.4 25.4 58.6 27.4 58 C32 56.4 34.4 50 34.4 43 C34.4 38 33 32 31 26 Z'
  }
}


export { crownPath }
