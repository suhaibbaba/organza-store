import {
  Armchair,
  Bone,
  Monitor,
  Target,
  Award,
  Gem,
  Heart,
  Smile,
  Star,
  ArrowUp,
  GripVertical,
  MoveHorizontal,
  MoreVertical,
  ListOrdered,
  Activity,
  AlertTriangle,
  ArrowDown,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  Copy,
  CreditCard,
  FileText,
  Fingerprint,
  Globe,
  Image as ImageIcon,
  Info,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Square,
  Stethoscope,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { JSX } from "react";
import { cn } from "@ui/lib/cn";
import type { TestIdProps } from "@ui/lib/testid";

export type IconName =
  | "activity"
  | "arrow-down"
  | "arrow-up"
  | "armchair"
  | "alert"
  | "award"
  | "bell"
  | "bone"
  | "building"
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-up"
  | "chevrons-up-down"
  | "chevron-end"
  | "chevron-start"
  | "clipboard"
  | "clock"
  | "coins"
  | "copy"
  | "edit"
  | "error"
  | "file"
  | "gear"
  | "grip"
  | "move-horizontal"
  | "heart"
  | "gem"
  | "globe"
  | "google"
  | "image"
  | "info"
  | "language"
  | "list"
  | "lock"
  | "login"
  | "logout"
  | "eye"
  | "eye-off"
  | "mail"
  | "map-pin"
  | "menu"
  | "message"
  | "money"
  | "monitor"
  | "more-vertical"
  | "package"
  | "passkey"
  | "phone"
  | "plus"
  | "print"
  | "receipt"
  | "send"
  | "sparkles"
  | "star"
  | "stop"
  | "target"
  | "reset"
  | "key"
  | "search"
  | "shield"
  | "smile"
  | "spinner"
  | "stethoscope"
  | "tooth"
  | "trash"
  | "trend-down"
  | "trend-up"
  | "upload"
  | "user"
  | "user-plus"
  | "users"
  | "whatsapp"
  | "x";

const ToothGlyph: LucideIcon = ((props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
      d="M12 3.4c-4.1 0-6.7 2.5-6.7 6.2 0 3.4 1.7 5.4 2.5 8.7.5 1.7 1.8 2.1 2.6 1.2.8-.9.8-3.7 1.6-3.7s.8 2.8 1.6 3.7c.8.9 2.1.5 2.6-1.2.8-3.3 2.5-5.3 2.5-8.7 0-3.7-2.6-6.2-6.7-6.2Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)) as LucideIcon;

const GoogleGlyph: LucideIcon = ((props) => (
  <svg viewBox="0 0 24 24" {...props} fill="currentColor" stroke="none">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.79 4.13-1.15 1.15-2.94 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.5 1.03 5.9 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05H12.48Z" />
  </svg>
)) as LucideIcon;

const WhatsAppGlyph: LucideIcon = ((props) => (
  <svg viewBox="0 0 24 24" {...props} fill="currentColor" stroke="none">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)) as LucideIcon;

const ICONS: Record<IconName, LucideIcon> = {
  activity: Activity,
  alert: AlertTriangle,
  "arrow-down": ArrowDown,
  "arrow-up": ArrowUp,
  armchair: Armchair,
  award: Award,
  bell: Bell,
  bone: Bone,
  building: Building2,
  calendar: CalendarDays,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "chevrons-up-down": ChevronsUpDown,
  "chevron-end": ChevronRight,
  "chevron-start": ChevronLeft,
  clipboard: ClipboardList,
  clock: Clock,
  coins: Coins,
  copy: Copy,
  edit: Pencil,
  error: XCircle,
  file: FileText,
  gear: Settings,
  grip: GripVertical,
  "move-horizontal": MoveHorizontal,
  heart: Heart,
  "more-vertical": MoreVertical,
  gem: Gem,
  globe: Globe,
  image: ImageIcon,
  info: Info,
  language: Languages,
  list: ListOrdered,
  lock: Lock,
  login: LogIn,
  logout: LogOut,
  eye: Eye,
  "eye-off": EyeOff,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  message: MessageSquare,
  money: CreditCard,
  monitor: Monitor,
  package: Package,
  passkey: Fingerprint,
  phone: Phone,
  plus: Plus,
  print: Printer,
  receipt: ReceiptText,
  key: KeyRound,
  send: Send,
  reset: RotateCcw,
  search: Search,
  shield: Shield,
  smile: Smile,
  sparkles: Sparkles,
  star: Star,
  spinner: Loader2,
  stop: Square,
  target: Target,
  stethoscope: Stethoscope,
  tooth: ToothGlyph,
  trash: Trash2,
  "trend-down": TrendingDown,
  "trend-up": TrendingUp,
  upload: Upload,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  google: GoogleGlyph,
  whatsapp: WhatsAppGlyph,
  x: X,
};

const DIRECTIONAL: Partial<
  Record<IconName, { readonly rtl: LucideIcon; readonly ltr: LucideIcon }>
> = {
  "chevron-end": { rtl: ChevronLeft, ltr: ChevronRight },
  "chevron-start": { rtl: ChevronRight, ltr: ChevronLeft },
};

const MIRRORED: ReadonlySet<IconName> = new Set(["login", "logout", "send"]);

export interface IconProps extends TestIdProps {
  readonly name: IconName;
  readonly size?: "sm" | "md" | undefined;
  readonly className?: string | undefined;
  readonly "data-part"?: string | undefined;
}

export function Icon({ name, size = "sm", className, ...attrs }: IconProps): JSX.Element {
  const directional = DIRECTIONAL[name];
  const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const Glyph = directional ? (isRtl ? directional.rtl : directional.ltr) : ICONS[name];

  return (
    <Glyph
      {...attrs}
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.75}
      className={cn(
        "shrink-0",
        size === "md" ? "size-5" : "size-[18px]",
        isRtl && MIRRORED.has(name) && "-scale-x-100",
        className,
      )}
    />
  );
}
