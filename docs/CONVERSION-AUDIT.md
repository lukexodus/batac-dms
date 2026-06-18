# Conversion Audit

## Brand Tokens
| Token Name | Hex | HSL | Semantic Role |
|---|---|---|---|
| Brand Primary | `#00A651` | `149 100% 33%` | Primary background, active states, focus rings |
| Seal Navy | `#1E3A8A` | `224 64% 33%` | City Seal outer ring |
| Seal Red | `#DC2626` | `0 72% 51%` | City Seal middle ring |
| Seal Gold | `#FBBF24` | `43 96% 56%` | City Seal text/sunburst |
| Seal Sky | `#7DB8F0` | `209 81% 71%` | City Seal shield upper |
| Seal Field Green | `#1A7A36` | `137 65% 29%` | City Seal shield lower |
| Sidebar Dark Green | `#0D3D20` | `144 65% 15%` | Sidebar, Topbar backgrounds |

## Kitchen Sink Inventory
| Element | Variants Found | Notes on Custom Styling |
|---|---|---|
| **Typography** | Display (36px Bold), Heading XL (24px Bold), Heading LG (20px Semibold), Heading MD (16px Semibold), Body (14px Regular), Small (12px Regular), Mono (14px Medium) | Using IBM Plex Sans, IBM Plex Mono for Tracking Numbers. |
| **Buttons** | `primary`, `secondary`, `danger`, `warning`, `ghost` | Includes `disabled` state and sizes `xs`, `sm`, `md`, `lg`. Often includes `lucide-react` icons. |
| **Status Badges** | Approved, Pending Approval, In Workflow, In Committee, For 1st Reading, For 2nd Reading, 3rd Reading, VP Certification, Released, Rejected, Under Investigation, Draft, Archived | Distinct semantic background/text colors for each label. |
| **Classification Badges** | Public, Internal, Confidential, Restricted | Standard pill shape. |
| **Alert Banners** | Success (Green), Warning (Amber), Danger (Red), Info (Blue) | Custom icon color, soft background, visible border. Title + body. |
| **Form Inputs** | Text Input, Date Input, Select, Search Input, Textarea | Custom focus rings (`brand-ring`), `border-gray-200`, `rounded-lg`, label styles. Includes an inline error state for required text. |

## Tailwind Class Inventory
| Class | Count | Maps to shadcn token |
|---|---|---|
| `text-xs` | 166 | `text-xs` |
| `text-sm` | 134 | `text-sm` |
| `text-gray-400` | 126 | `text-muted-foreground` |
| `border-gray-200` | 117 | `border-border` / `border-input` |
| `rounded-lg` | 97 | `rounded-lg` (set to `--radius`) |
| `text-gray-500` | 79 | `text-muted-foreground` |
| `bg-white` | 75 | `bg-background` / `bg-card` |
| `text-gray-900` | 64 | `text-foreground` |
| `rounded-xl` | 58 | `rounded-xl` |
| `rounded-full` | 38 | `rounded-full` |
| `text-gray-700` | 35 | `text-secondary-foreground` |

## Component Inventory
| Pattern | Current Impl | Target shadcn component | Gap |
|---|---|---|---|
| Primary action button | `<button className="bg-primary-700...">` | `Button` | Needs `variant="primary"` mapped to default. |
| Secondary action button | `<button className="bg-white border...">` | `Button` | Needs `variant="secondary"` / `outline`. |
| Document status badge | `<span className="rounded-full...">` | `Badge` | Many custom variants needed (Draft, Filed, Approved, Archived, etc). |
| Alert banner | `<div className="flex bg-red-50 border...">` | `Alert` | Add `success`, `warning` variants to `alert.tsx`. |
| Card surface | `<div className="bg-white rounded-xl border...">` | `Card` | Needs standard `CardHeader` / `CardContent`. |
| Text input | `<input className="border border-gray-200 rounded-lg...">` | `Input` | Focus ring styling. |
| Select | `<select className="...">` | `Select` | - |
| Form layout | Raw HTML with labels | `Form` / `FormField` | - |
| Modal | `<div className="fixed inset-0...">` | `Dialog` / `AlertDialog` | - |

## API Layer Inventory
| Function | Return Shape | Data Source |
|---|---|---|
| `usePendingSignatures` | `Array<Document>` | `/pendingSignatures` (via `apiClient`) |
| `useSLAData` | `Array<SLAItem>` | `/slaData` (via `apiClient`) |
| `useDeptWorkload` | `Array<WorkloadItem>` | `/deptWorkload` (via `apiClient`) |
| `useLegislativeQueue` | `Array<LegislativeItem>` | `/legislativeQueue` (via `apiClient`) |
| `useSessionCalendar` | `Array<SessionItem>` | `/sessionCalendar` (via `apiClient`) |
| `useLegislativeOutput` | `Array<OutputItem>` | `/legislativeOutput` (via `apiClient`) |
| `useRoutingHistory` | `Array<RoutingEntry>` | `/routingHistory` (via `apiClient`) |
| `useDocuments` | `Array<Document>` | `/documents` (via `apiClient`) |
| `usePublicOrdinances`| `Array<Document>` | `/publicOrdinances` (via `apiClient`) |

## Open Questions
- Do we use `pnpm` exclusively as indicated by the task list (`pnpm add -D shadcn@latest`), considering I should use standard `npx` when initializing shadcn? I will default to `pnpm`.
- Are there any other specific components to include in the UI that weren't captured by the initial regex run?
