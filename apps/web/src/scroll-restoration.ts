interface ScrollRestorationLocation {
  pathname: string;
  searchStr: string;
}

export function scrollRestorationKey(
  location: ScrollRestorationLocation,
): string {
  return `${location.pathname}${location.searchStr}`;
}
