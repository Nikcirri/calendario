<script lang="ts" module>
  // Icone a tratto disegnate per l'app (24 × 24).
  const PATHS = {
    menu: 'M4 7h16M4 12h16M4 17h16',
    search: 'M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM16 16l4.5 4.5',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    back: 'M15 6l-6 6 6 6',
    chevronRight: 'M9 6l6 6-6 6',
    chevronDown: 'M6 9l6 6 6-6',
    bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z',
    clock: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM12 7.5V12l3 2',
    pin: 'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11zM12 7.7a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z',
    tag: 'M4 12.5V5.5A1.5 1.5 0 0 1 5.5 4h7l7.5 7.5-8.5 8.5L4 12.5zM8.5 7.3a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 1 0 0-2.4z',
    calendar:
      'M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5zM4 10h16M8.5 3.5v4M15.5 3.5v4',
    bell: 'M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14l1.5-2zM10 20.5a2 2 0 0 0 4 0',
    repeat: 'M5 11V9.5A3.5 3.5 0 0 1 8.5 6H18l-2.5-2.5M19 13v1.5a3.5 3.5 0 0 1-3.5 3.5H6l2.5 2.5',
    note: 'M7.5 4h9A2.5 2.5 0 0 1 19 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5v-11A2.5 2.5 0 0 1 7.5 4zM8.5 9h7M8.5 13h7M8.5 17h4',
    checklist: 'M4 7l1.8 1.8L9 5.5M4 13l1.8 1.8L9 11.5M4 19l1.8 1.8L9 17.5M12.5 7H20M12.5 13H20M12.5 19H20',
    trash: 'M5 7h14M10 7V4.5h4V7M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h5.4a1.5 1.5 0 0 0 1.5-1.5L17 7',
    refresh: 'M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5v3.5H14M6.5 20.5V17H10',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
    upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14',
    settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM8 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
    viewYear:
      'M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16',
    viewWeek: 'M6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9A2.5 2.5 0 0 1 6.5 5zM8 5v14M12 5v14M16 5v14',
    viewDay: 'M8.5 4h7A2.5 2.5 0 0 1 18 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 17.5v-11A2.5 2.5 0 0 1 8.5 4zM9.5 9h5',
    viewAgenda: 'M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01',
    chart: 'M5 20V11M12 20V5M19 20v-6',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    edit: 'M4 20h4L18.5 9.5l-4-4L4 16v4zM13 7l4 4',
    warning: 'M12 4.5l8.5 14.5h-17L12 4.5zM12 10.5v4M12 17h.01',
    arrowRight: 'M5 12h14M13 6l6 6-6 6',
    undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    send: 'M12 19V5M5.5 11.5L12 5l6.5 6.5',
    info: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM12 11v5.5M12 7.5v.5',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
    party: 'M4 20l4.5-12 7.5 7.5L4 20zM14 4v2M19.5 9.5h-2M17.5 5.5l-1.5 1.5M12.5 9a2.5 2.5 0 0 0 0-3.5M15 11.5a2.5 2.5 0 0 1 3.5 0',
  } as const;

  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 24, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
