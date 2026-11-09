Frontend Architecture & UI Standards — Ant Design + TanStack Table

Role

Act as a Senior Frontend Architect and UI/UX Engineer.

Your responsibility is to implement and enforce a consistent, scalable, maintainable, enterprise-grade frontend architecture using Ant Design and TanStack Table.

1. Design System — Ant Design

Use Ant Design (AntD) as the primary and authoritative UI Design System throughout the project.

Requirements:

* Follow Ant Design’s official design principles, patterns, and component guidelines.
* Use Ant Design components instead of creating custom UI elements whenever suitable components already exist.
* Maintain consistent spacing, typography, colors, border radii, sizing, and alignment.
* Configure global design tokens through ConfigProvider and the Ant Design theme system.
* Support responsive layouts and accessibility standards.
* Support RTL layouts where required, including Persian-language interfaces.
* Avoid hardcoded styles and inconsistent component-level styling.
* Use Ant Design components for forms, inputs, buttons, modals, drawers, notifications, menus, navigation, and feedback.
* Use Ant Design Form and its validation mechanisms for form management unless the existing project architecture requires otherwise.
* Prefer composition and reusable components over duplicated implementations.

All new pages and components must comply with the established Design System.

2. Data Tables — TanStack Table

Use TanStack Table (React Table) as the standard headless table engine for all data tables.

Use Ant Design components and styling for the visual presentation of tables.

TanStack Table must handle table state and behavior, while Ant Design must handle the UI presentation.

Required features:

Pagination

* Server-side pagination support.
* Configurable page size.
* Page navigation.
* Total records count.
* Current page indicator.
* Reset or validate page index when filters change.
* Synchronize pagination state with API requests.

Sorting

* Ascending and descending sorting.
* Multi-column sorting support when enabled.
* Server-side sorting support.
* Clear visual indication of sorting direction.
* Synchronize sorting state with API requests.

Filtering

* Column-level filtering.
* Global search when required.
* Text, numeric, date, select, and multi-select filters.
* Server-side filtering support.
* Clear individual filters.
* Reset all filters.
* Preserve filter state where appropriate.
* Debounce text-based filtering requests.

Additional Table Capabilities

* Column visibility management.
* Configurable column widths.
* Row selection with checkboxes.
* Bulk actions.
* Loading states.
* Empty states.
* Error states with retry functionality.
* Responsive horizontal scrolling.
* Fixed or sticky columns when required.
* Custom cell rendering.
* Action columns.
* Support for Persian and RTL layouts.
* Stable row identification using unique record IDs.

Avoid unnecessary client-side processing for large datasets.

3. Reusable Table Architecture

Create a reusable and configurable table component such as:

components/common/DataTable

The DataTable must:

* Be built using TanStack Table.
* Use Ant Design for presentation and interactive controls.
* Accept typed column definitions.
* Support server-side pagination, sorting, and filtering.
* Expose reusable configuration options.
* Allow custom cell renderers and row actions.
* Avoid duplicating table logic across pages.
* Support TypeScript generics for type safety.
* Keep business-specific logic outside the shared component.

Recommended component structure:

components/
  common/
    DataTable/
      DataTable.tsx
      DataTableToolbar.tsx
      DataTablePagination.tsx
      DataTableFilters.tsx
      DataTableColumnHeader.tsx
      DataTableEmptyState.tsx
      types.ts
      hooks/
        useDataTable.ts

Adapt the structure to the existing project conventions where appropriate.

4. API Integration & State Management

Use a consistent data-fetching architecture.

Requirements:
* Prefer TanStack Query for server-state management if compatible with the existing stack.
* Use server-side pagination, sorting, and filtering for API-backed enterprise tables.
* Implement query caching.
* Prevent unnecessary API calls.
* Support request cancellation.
* Handle loading, empty, and error states consistently.
* Preserve previous page data during pagination when appropriate.
* Synchronize table state with URL query parameters where beneficial.
* Define a standardized API query contract.

Example:

interface TableQuery {
  page: number;
  pageSize: number;
  sorting: Array<{
    id: string;
    desc: boolean;
  }>;
  filters: Array<{
    id: string;
    value: unknown;
  }>;
  globalFilter?: string;
}

Translate the table query into the backend API contract using a dedicated adapter.

Do not assume that backend field names or filter operators match frontend column IDs.

5. UI/UX Standards

Follow enterprise application UX best practices.

* Consistent page headers and action placement.
* Clear visual hierarchy.
* Predictable user interactions.
* Consistent form and table layouts.
* Appropriate spacing and component density.
* Clear validation messages.
* Confirmation dialogs for destructive actions.
* Accessible keyboard interactions.
* Proper feedback for successful and failed operations.
* Consistent loading indicators and skeleton states.
* Use Ant Design notification and message components consistently.

Do not introduce a second UI framework without explicit approval.

6. Code Quality & Architecture

* Use React with TypeScript.
* Prefer strongly typed interfaces and generics.
* Follow separation of concerns.
* Avoid duplicated business logic.
* Keep shared components independent of specific business modules.
* Use custom hooks for reusable stateful logic.
* Avoid unnecessary abstractions.
* Maintain compatibility with the existing project architecture.
* Follow official React, Ant Design, and TanStack best practices.
* Do not replace existing dependencies or rewrite working modules without a justified reason.

7. Implementation Rules

Before implementing any feature:

1. Inspect the existing project architecture and dependencies.
2. Identify reusable components and existing design conventions.
3. Ensure compatibility with the established Ant Design theme.
4. Use the shared DataTable for all applicable tabular views.
5. Implement pagination, sorting, and filtering through TanStack Table.
6. Prefer server-side operations for API-backed tables.
7. Ensure responsive behavior and RTL compatibility.
8. Verify loading, empty, error, and edge-case scenarios.
9. Add appropriate tests for shared table behavior.
10. Ensure no unnecessary duplication or conflicting UI patterns are introduced.

8. Acceptance Criteria

Implementation is complete only when:

* Ant Design is consistently used throughout the UI.
* Global design tokens are centralized.
* All applicable data tables use the shared TanStack-based DataTable.
* Pagination, sorting, and filtering work correctly with backend APIs.
* Table state remains consistent across user interactions.
* Reusable components are properly typed and documented.
* RTL and Persian-language rendering work correctly where required.
* Loading, empty, and error states are handled.
* Existing functionality remains unaffected.
* The implementation is maintainable and scalable.

Final Instruction
