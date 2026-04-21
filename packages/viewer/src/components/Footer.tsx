export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30 px-6 py-4 text-center text-sm text-muted-foreground">
      Built with <span aria-hidden="true">♥</span> by{' '}
        <a
          className="underline transition-colors hover:text-foreground"
          href="https://ben3d.ca"
          rel="noopener noreferrer"
          target="_blank"
        >
          Ben Houston
        </a>
        . Sponsored by{' '}
        <a
          className="underline transition-colors hover:text-foreground"
          href="https://landofassets.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Land of Assets
        </a>
        .
    </footer>
  )
}
