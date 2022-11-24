function preventClickHandler(event: any) {
  event.stopPropagation();
  document.body.removeEventListener('click', preventClickHandler, true);
}

export default function preventClick(values: any) {
  document.body.addEventListener('click', preventClickHandler, true);
}
