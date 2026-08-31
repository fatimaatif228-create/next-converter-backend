## Recommended Step-by-Step Conversion Algorithm

The converter should follow this process when converting a WordPress theme into a Next.js project.

### 1. Scan the WordPress Theme Folder

Read the theme directory and identify important files:

- `functions.php`
- `style.css`
- `index.php`
- `front-page.php`
- `home.php`
- `single.php`
- `page.php`
- `archive.php`
- `404.php`
- `header.php`
- `footer.php`
- `sidebar.php`
- `template-parts/`
- `assets/`

**Can automate:**

- Detect files and folders in the theme directory.
- Identify common WordPress template files.
- Find assets such as CSS, JavaScript, images, and fonts.

**Needs manual review:**

- Unusual folder structures.
- Custom theme-specific files.
- Files created by plugins or custom developers.

---

### 2. Classify Each File

Group files by purpose:

| File Type | Example | Converter Action |
|---|---|---|
| Page templates | `single.php`, `page.php`, `archive.php` | Convert to Next.js route files |
| Reusable partials | `header.php`, `footer.php`, `template-parts/*.php` | Convert to React components |
| Theme setup | `functions.php` | Analyze for menus, assets, sidebars, theme support |
| Styles/assets | `style.css`, `assets/` | Copy or import into Next.js |

**Can automate:**

- Classify common WordPress files.
- Separate route templates from reusable components.
- Mark `functions.php` as analysis-only.

**Needs manual review:**

- Custom templates like `single-product.php`.
- Plugin-specific templates.
- Templates with unclear purpose.

---

### 3. Parse PHP Templates

Use `php-parser` to parse PHP template files into an AST.

The converter should detect:

- WordPress template tags
- WordPress loops
- Conditional tags
- Inline HTML
- Included templates
- Reusable template parts

**Can automate:**

- Parse PHP files into ASTs.
- Detect known WordPress functions like `the_title()`, `the_content()`, and `get_header()`.
- Detect loops and conditionals.

**Needs manual review:**

- Complex custom PHP logic.
- Direct database queries.
- Dynamic function names.
- Unsupported PHP patterns.

---

### 4. Map WordPress Templates to Next.js Routes

Convert page-level WordPress templates into Next.js route files.

| WordPress Template | Next.js Output |
|---|---|
| `front-page.php` | `app/page.tsx` |
| `home.php` | `app/blog/page.tsx` |
| `single.php` | `app/blog/[slug]/page.tsx` |
| `page.php` | `app/[slug]/page.tsx` |
| `category.php` | `app/category/[slug]/page.tsx` |
| `tag.php` | `app/tag/[slug]/page.tsx` |
| `author.php` | `app/author/[slug]/page.tsx` |
| `search.php` | `app/search/page.tsx` |
| `404.php` | `app/not-found.tsx` |

**Can automate:**

- Map common WordPress templates to standard Next.js routes.
- Generate dynamic routes using `[slug]`.
- Create default route files.

**Needs manual review:**

- Highly specific templates like `category-news.php`.
- Custom post type templates.
- Template hierarchy conflicts.

---

### 5. Convert Reusable PHP Files to React Components

Convert reusable theme files into components.

| WordPress File | Next.js Component |
|---|---|
| `header.php` | `components/Header.tsx` |
| `footer.php` | `components/Footer.tsx` |
| `sidebar.php` | `components/Sidebar.tsx` |
| `comments.php` | `components/Comments.tsx` |
| `template-parts/*.php` | `components/template-parts/*.tsx` |

**Can automate:**

- Convert common partials into React component files.
- Replace `get_header()` with `<Header />`.
- Replace `get_footer()` with `<Footer />`.
- Replace `get_sidebar()` with `<Sidebar />`.

**Needs manual review:**

- Widget areas.
- Complex header/footer logic.
- Dynamic template parts.

---

### 6. Convert WordPress Template Tags

Map common WordPress template tags to REST API fields.

| WordPress Tag | Next.js / REST API Equivalent |
|---|---|
| `the_title()` | `post.title.rendered` |
| `the_content()` | `post.content.rendered` |
| `the_excerpt()` | `post.excerpt.rendered` |
| `the_permalink()` | `/blog/${post.slug}` |
| `the_post_thumbnail()` | media from `post.featured_media` |
| `the_author()` | author from `_embed` or `/wp/v2/users/{id}` |

**Can automate:**

- Convert common template tags.
- Map REST API fields to React output.
- Generate basic JSX for title, content, excerpt, and links.

**Needs manual review:**

- Custom template tags.
- Plugin-generated content.
- Tags that depend on WordPress runtime behavior.

---

### 7. Convert WordPress Loops

Convert WordPress loops into JavaScript array rendering.

WordPress:

~~~php
<?php if ( have_posts() ) : ?>
  <?php while ( have_posts() ) : the_post(); ?>
    <?php the_title(); ?>
  <?php endwhile; ?>
<?php endif; ?>
~~~

Next.js:

~~~tsx
{posts.map((post) => (
  <h2 key={post.id}>{post.title.rendered}</h2>
))}
~~~

**Can automate:**

- Convert basic `have_posts()` loops into `.map()`.
- Add empty states for no posts.
- Use `post.id` as a React key.

**Needs manual review:**

- Nested loops.
- Custom queries.
- Loops using plugin data or custom fields.

---

### 8. Convert WordPress Conditionals

Convert WordPress conditional tags into route-based logic when possible.

| WordPress Conditional | Next.js Equivalent |
|---|---|
| `is_front_page()` | `app/page.tsx` |
| `is_single()` | `app/blog/[slug]/page.tsx` |
| `is_page()` | `app/[slug]/page.tsx` |
| `is_category()` | `app/category/[slug]/page.tsx` |
| `is_404()` | `app/not-found.tsx` |

**Can automate:**

- Replace common WordPress conditionals with route-based structure.
- Move page-specific logic into the correct Next.js route.

**Needs manual review:**

- Large `if/else` blocks with custom behavior.
- User-specific logic.
- Conditional logic based on plugins or custom fields.

---

### 9. Fetch WordPress Content from the REST API

Use the WordPress REST API to get actual site content.

Important endpoints:

- `/wp/v2/posts`
- `/wp/v2/pages`
- `/wp/v2/media`
- `/wp/v2/categories`
- `/wp/v2/tags`
- `/wp/v2/users`
- `/wp/v2/menu-items`
- `/wp/v2/menu-locations`

**Can automate:**

- Fetch posts, pages, media, categories, tags, and users.
- Use slugs to generate dynamic routes.
- Fetch menu items and menu locations.

**Needs manual review:**

- Private content.
- Authenticated endpoints.
- Custom post types.
- Custom fields not exposed through REST API.

---

### 10. Generate Next.js Data Fetching Helpers

Create helper functions for fetching WordPress content.

Example output:

~~~ts
export async function getPosts() {
  const res = await fetch(`${process.env.WP_API_URL}/wp/v2/posts?_embed`);
  return res.json();
}
~~~

**Can automate:**

- Generate basic API helper functions.
- Use environment variables for the WordPress API URL.
- Add helpers for posts, pages, media, menus, and categories.

**Needs manual review:**

- Error handling strategy.
- Caching strategy.
- Authentication.
- Preview/draft content.

---

### 11. Copy and Map Assets

Copy theme assets into the Next.js project.

| WordPress Asset | Next.js Location |
|---|---|
| `style.css` | `app/globals.css` or imported CSS file |
| `assets/css/*` | `public/wp-assets/css/` |
| `assets/js/*` | `public/wp-assets/js/` or converted React logic |
| `assets/images/*` | `public/wp-assets/images/` |

**Can automate:**

- Copy CSS files.
- Copy images and static assets.
- Import global CSS.
- Preserve asset folder structure.

**Needs manual review:**

- JavaScript that depends on jQuery.
- Inline scripts.
- Scripts that directly manipulate the DOM.
- CSS conflicts with React/Next.js structure.

---

### 12. Generate TODO Comments for Manual Work

Some WordPress features may be difficult to fully automate.

Generate TODO comments for:

- Custom widgets
- Complex shortcodes
- Customizer settings
- Plugin-specific behavior
- Dynamic PHP logic
- Custom database queries
- Complex menu dropdown behavior
- Forms and comments
- Authentication-dependent content

Example:

~~~tsx
{/* TODO: Manually convert WordPress widget area sidebar-1 */}
~~~

**Can automate:**

- Detect risky or unsupported patterns.
- Insert clear TODO comments.
- Preserve original context when possible.

**Needs manual review:**

- Actually implementing the TODO items.
- Confirming behavior matches the original WordPress site.
- Rebuilding plugin-specific features.

---

### 13. Generate the Final Next.js Project Structure

The converter should output a structure like:

~~~text
app/
├── layout.tsx
├── page.tsx
├── not-found.tsx
├── blog/
│   ├── page.tsx
│   └── [slug]/
│       └── page.tsx
├── [slug]/
│   └── page.tsx
├── category/
│   └── [slug]/
│       └── page.tsx
└── search/
    └── page.tsx

components/
├── Header.tsx
├── Footer.tsx
├── Sidebar.tsx
└── template-parts/

lib/
└── wordpress.ts

public/
└── wp-assets/
~~~

**Can automate:**

- Generate the base Next.js folder structure.
- Create route files and component files.
- Place assets in the correct folders.

**Needs manual review:**

- Naming conventions.
- Final component organization.
- Whether routes match the intended site structure.

---

### 14. Validate the Output

After generating the Next.js project, the converter should check:

- Routes were created correctly
- Components were generated
- CSS/assets were copied
- REST API calls work
- Posts and pages render correctly
- TODO comments were added where automation was unsafe

**Can automate:**

- Check that files were generated.
- Check that API calls return data.
- Check that required folders exist.
- Run formatting or linting.

**Needs manual review:**

- Visual accuracy.
- User interactions.
- Plugin behavior.
- Forms, comments, auth, and custom features.

---

### Summary

The conversion process should be:

1. Scan theme files.
2. Classify templates, components, assets, and setup files.
3. Parse PHP files into ASTs.
4. Detect WordPress functions, loops, and conditionals.
5. Map templates to Next.js routes.
6. Map reusable files to React components.
7. Fetch content from the WP REST API.
8. Copy styles and assets.
9. Generate TODO comments for unsupported features.
10. Output and validate the Next.js project.

### Automation vs Manual Work

The converter can automate predictable patterns such as template mapping, common template tags, basic loops, basic conditionals, REST API fetching, asset copying, and TODO generation.

Developers should manually review custom PHP logic, plugins, shortcodes, widgets, forms, authentication, custom fields, complex JavaScript, jQuery behavior, and visual accuracy.

The goal is not a perfect one-click conversion. The goal is to generate a strong Next.js starting point and clearly mark the parts that need developer review.




## Automation vs Manual Work During Conversion

During the actual WordPress to Next.js conversion, the converter should automate predictable patterns and generate TODO comments for anything risky or site-specific.

| Conversion Area | Can Automate | Needs Manual Review |
|---|---|---|
| Template routing | Map `front-page.php`, `single.php`, `page.php`, `archive.php`, and `404.php` to Next.js route files | Custom templates like `single-product.php`, `category-news.php`, or unusual routing behavior |
| Reusable components | Convert `header.php`, `footer.php`, `sidebar.php`, and `template-parts/*.php` into React components | Complex header/footer logic, dynamic template parts, widget-heavy sidebars |
| Template tags | Map common tags like `the_title()`, `the_content()`, `the_excerpt()`, and `the_permalink()` to REST API fields | Custom template tags or plugin-specific output |
| WordPress loops | Convert basic `have_posts()` / `while` loops into `posts.map(...)` | Nested loops, custom queries, or loops over custom plugin data |
| WordPress conditionals | Map common conditionals like `is_single()`, `is_page()`, and `is_404()` to Next.js route files | Large custom `if/else` blocks or user-specific logic |
| REST API content | Fetch posts, pages, media, categories, tags, users, and menus from `/wp/v2` endpoints | Private content, authenticated data, custom post types, or custom fields not exposed in REST |
| Assets | Copy CSS, images, fonts, and static files into the Next.js project | JavaScript that depends on jQuery, inline scripts, or DOM manipulation |
| Menus | Fetch menu locations and menu items, then generate basic navigation components | Nested dropdowns, mega menus, or menu behavior controlled by custom JavaScript |
| Styling | Import/copy global WordPress CSS and preserve WordPress block classes | CSS cleanup, visual polish, responsive fixes, and conflicts with React structure |
| Unsupported features | Generate TODO comments for risky areas | Developers should implement plugins, shortcodes, forms, widgets, comments, auth, and custom fields manually |


## Edge Cases and Limitations

A WordPress to Next.js converter cannot safely automate every WordPress feature. Some parts can be converted directly, while others should generate TODO comments for manual review.

### 1. Custom PHP Logic

Some themes contain custom PHP logic that does more than display content.

Examples:

- Custom functions
- Complex `if/else` logic
- Loops over custom data
- Direct database queries
- Plugin-specific function calls

**Handling suggestion:**

The converter should parse the file, convert known WordPress functions, and insert a TODO for unknown custom logic.

~~~tsx
{/* TODO: Review custom PHP logic from original theme */}
~~~

---

### 2. Plugins and Shortcodes

WordPress content may include plugin shortcodes such as:

~~~text
[contact-form-7]
[gallery]
[products]
[slider]
~~~

These do not automatically work in Next.js.

**Handling suggestion:**

Detect shortcode patterns and generate placeholder components or TODO comments.

~~~tsx
{/* TODO: Replace WordPress shortcode [contact-form-7] with a React form component */}
~~~

---

### 3. Widgets and Sidebars

WordPress widgets are dynamic and may be configured in the admin dashboard.

Examples:

- Footer widgets
- Sidebar widgets
- Search widget
- Recent posts widget
- Custom HTML widget

**Handling suggestion:**

Convert the sidebar area structure, but mark widget content for manual review.

~~~tsx
{/* TODO: Convert WordPress widget area sidebar-1 */}
~~~

---

### 4. Menus with Nested Dropdowns

Simple menus can be fetched from the REST API, but nested menus may require rebuilding the parent-child structure.

**Handling suggestion:**

Use `parent` and `menu_order` from menu items to rebuild nested navigation.

If nesting is too complex, generate a TODO.

~~~tsx
{/* TODO: Verify nested menu dropdown behavior */}
~~~

---

### 5. Theme Customizer Settings

WordPress themes may rely on Customizer settings for:

- Logo
- Colors
- Fonts
- Dark mode
- Layout options
- Header/footer settings

**Handling suggestion:**

Convert known settings when available through REST API or theme files. Add TODO comments for unsupported customizer settings.

~~~tsx
{/* TODO: Manually verify theme customizer settings */}
~~~

---

### 6. Dynamic WordPress Functions

Some WordPress functions depend on runtime WordPress behavior.

Examples:

- `body_class()`
- `post_class()`
- `wp_head()`
- `wp_footer()`
- `comments_template()`

**Handling suggestion:**

Map simple class functions when possible. For `wp_head()` and `wp_footer()`, manually move needed scripts/styles into Next.js.

~~~tsx
{/* TODO: Review original wp_head/wp_footer output for scripts, metadata, or plugin code */}
~~~

---

### 7. Forms

WordPress forms may come from plugins or custom PHP.

Examples:

- Contact forms
- Search forms
- Login forms
- Comment forms
- Newsletter forms

**Handling suggestion:**

Convert simple search forms. Generate TODOs for plugin-based or backend-dependent forms.

~~~tsx
{/* TODO: Rebuild this WordPress form as a React component */}
~~~

---

### 8. Comments

WordPress comments depend on WordPress backend behavior.

**Handling suggestion:**

If comments are needed, fetch comments from `/wp/v2/comments`. Otherwise, generate a placeholder or TODO.

~~~tsx
{/* TODO: Decide whether to support WordPress comments in the converted site */}
~~~

---

### 9. Authentication and User-Specific Content

Some WordPress content depends on whether a user is logged in.

Examples:

- `is_user_logged_in()`
- `current_user_can()`
- Admin-only content
- Member-only pages

**Handling suggestion:**

Do not automatically convert authentication logic. Add TODO comments and require manual auth design in Next.js.

~~~tsx
{/* TODO: Rebuild WordPress authentication/permission logic in Next.js */}
~~~

---

### 10. Custom Post Types

WordPress sites may use custom post types such as:

- Products
- Events
- Portfolio items
- Testimonials

**Handling suggestion:**

Detect custom post types from REST API `/wp/v2/types`. Generate dynamic routes for supported types or TODOs for unknown ones.

~~~text
app/products/[slug]/page.tsx
app/events/[slug]/page.tsx
~~~

---

### 11. Custom Fields / ACF

Many WordPress sites use custom fields through plugins like ACF.

**Handling suggestion:**

If custom fields appear in the REST API, map them to props. If not exposed, add a TODO.

~~~tsx
{/* TODO: Verify custom fields / ACF data source */}
~~~

---

### 12. Inline Scripts

Themes may include inline JavaScript inside PHP templates.

**Handling suggestion:**

Move simple scripts into React components or separate JS files. Complex DOM scripts should be flagged.

~~~tsx
{/* TODO: Review inline JavaScript behavior from original template */}
~~~

---

### 13. jQuery Dependencies

Older WordPress themes may depend on jQuery.

**Handling suggestion:**

Avoid directly copying jQuery behavior if possible. Rebuild interactions using React state and effects.

~~~tsx
{/* TODO: Replace jQuery behavior with React logic */}
~~~

---

### 14. CSS Conflicts

WordPress CSS may rely on global selectors and WordPress-generated classes.

Examples:

- `.wp-block-*`
- `.alignwide`
- `.entry-content`
- `.screen-reader-text`

**Handling suggestion:**

Copy global CSS first, then clean up later. Preserve WordPress block classes if rendering `content.rendered`.

---

### 15. Media and Image Paths

WordPress content may contain image URLs pointing to `/wp-content/uploads`.

**Handling suggestion:**

Download media from `/wp/v2/media`, copy images into `public/`, and rewrite image URLs where possible.

If media is missing, keep the original URL and add a TODO.

---

### 16. Gutenberg Block HTML

WordPress block editor content returns rendered HTML through `content.rendered`.

**Handling suggestion:**

Render simple block HTML with `dangerouslySetInnerHTML`. For long-term conversion, map common block classes to React components.

~~~tsx
<div dangerouslySetInnerHTML={{ __html: post.content.rendered }} />
~~~

---

### 17. Template Hierarchy Conflicts

WordPress has many fallback rules. A theme may include both general and specific templates.

Examples:

- `index.php`
- `home.php`
- `front-page.php`
- `single.php`
- `single-product.php`
- `category-news.php`

**Handling suggestion:**

Follow WordPress template hierarchy priority. More specific templates should override general templates.

---

### 18. Missing Template Files

Some themes do not include every possible template file.

**Handling suggestion:**

Use fallback mappings.

Example:

| Missing File | Fallback |
|---|---|
| `front-page.php` missing | Use `index.php` or `home.php` |
| `single.php` missing | Use `index.php` |
| `page.php` missing | Use `index.php` |
| `404.php` missing | Generate default `not-found.tsx` |

---

### 19. Unsupported PHP Syntax

Some PHP syntax may be difficult to convert automatically.

Examples:

- Anonymous functions
- Complex arrays
- Dynamic includes
- Variable function names
- Namespaced classes

**Handling suggestion:**

Parse with `php-parser`, convert known patterns, and add TODO comments for unsupported syntax.

---

### 20. Exact Visual Matching

The converted Next.js site may not perfectly match the original WordPress site.

Reasons:

- Plugin styles may be missing
- WordPress runtime classes may differ
- Customizer settings may not transfer
- Widgets may need manual rebuilding
- JavaScript interactions may need rewriting

**Handling suggestion:**

Aim for a strong first-pass conversion, then require manual QA and cleanup.

---

## Summary

The converter should automate:

- Template file mapping
- Common template tags
- Basic loops
- Basic conditionals
- REST API content fetching
- CSS and asset copying
- Simple menus

The converter should generate TODOs for:

- Custom PHP logic
- Plugins
- Shortcodes
- Widgets
- Forms
- Authentication
- Custom fields
- Complex JavaScript
- jQuery behavior
- Unsupported PHP patterns

The goal is not perfect one-click conversion. The goal is to generate a strong Next.js starting point with clear TODO comments where manual review is needed.