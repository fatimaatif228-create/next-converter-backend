## 1. WordPress Theme Structure

### 1.1 What Is a WordPress Theme?

A WordPress theme is a collection of files that controls how the frontend of a WordPress site looks and behaves. Themes define page layouts, templates, styles, scripts, media, menus, sidebars, and reusable sections.

WordPress themes can be classic themes or block themes. Classic themes mainly use `.php` template files, while block themes use `.html` templates and `theme.json`.

Common things inside a theme include:

- **Templates**: Define page structure. Classic themes use `.php`; block themes use `.html`.
- **CSS**: Controls colors, fonts, spacing, layout, and responsiveness.
- **JavaScript**: Adds interactivity such as menus, sliders, and animations.
- **PHP**: Runs WordPress logic and dynamically outputs content.
- **Media**: Includes images, videos, icons, and fonts.
- **JSON**: Stores configuration, especially in block themes through `theme.json`.

### 1.2 WordPress Template Hierarchy

The WordPress Template Hierarchy is the system WordPress uses to decide which template file should load for a specific URL.

WordPress first identifies the type of page being requested, such as a blog post, normal page, category page, search page, homepage, or 404 page. It then looks for the most specific matching template file in the theme. If that file does not exist, WordPress falls back to more general files until it reaches `index.php`.

Examples:

- A single blog post may use `single.php`
- A normal page may use `page.php`
- A category page may use `category.php`
- An archive page may use `archive.php`
- A search page may use `search.php`
- A 404 page may use `404.php`
- If no specific file exists, WordPress uses `index.php`

### 1.3 WordPress Template Tags

WordPress template tags are built-in PHP functions that retrieve and display WordPress data inside theme files.

Common template tags include:

| Template Tag | Description | Data Retrieved |
|---|---|---|
| `the_title()` | Displays the current post/page title | Post/Page title |
| `the_content()` | Displays the current post/page content | Post/Page content |
| `get_permalink()` | Returns the URL of the current post/page | Post/Page URL |
| `the_post()` | Sets up the current post for template tags | Current post object |
| `have_posts()` | Checks if more posts are available | Boolean result |

Template tags are commonly used inside the WordPress Loop.

### 1.4 WordPress Loops

The WordPress Loop is the code WordPress uses to go through posts returned by the current query and display each one.

```php
<?php if ( have_posts() ) : ?>
    <?php while ( have_posts() ) : the_post(); ?>

        <h2><?php the_title(); ?></h2>
        <div><?php the_content(); ?></div>

    <?php endwhile; ?>
<?php endif; ?>
```

In simple terms:

`WordPress query → list of posts → Loop processes each post → template tags display the data`

### 1.5 WordPress Conditional Tags

WordPress conditional tags are built-in PHP functions that return `true` or `false` depending on the type of page being displayed.

They let themes show different content or layouts depending on the page type.

Example:

```php
<?php if ( is_single() ) : ?>
    <p>This is a single blog post.</p>
<?php endif; ?>
```

Common conditional tags:

| Conditional Tag | What It Checks |
|---|---|
| `is_single()` | Single blog post |
| `is_page()` | Normal WordPress page |
| `is_archive()` | Archive page |
| `is_category()` | Category archive |
| `is_tag()` | Tag archive |
| `is_home()` | Blog posts index |
| `is_front_page()` | Site homepage |
| `is_search()` | Search results page |
| `is_404()` | 404 not found page |

### 1.6 `functions.php`

In a classic WordPress theme, `functions.php` acts like the theme setup file.

It is commonly used to register:

- Navigation menus
- Sidebars/widget areas
- CSS stylesheets
- JavaScript files
- Theme support features

Menus are registered with `register_nav_menus()` and displayed with `wp_nav_menu()`.

Sidebars are registered with `register_sidebar()` and displayed with `dynamic_sidebar()`.

CSS and JavaScript files are loaded using WordPress enqueue functions.

### 1.7 WordPress Assets

WordPress themes usually load CSS and JavaScript through `functions.php` instead of hardcoding `<link>` and `<script>` tags in template files.

The two main functions are:

- `wp_enqueue_style()` for CSS files
- `wp_enqueue_script()` for JavaScript files

Example:

```php
function theme_enqueue_assets() {
    wp_enqueue_style('main-style', get_stylesheet_uri());

    wp_enqueue_script(
        'main-script',
        get_template_directory_uri() . '/assets/js/main.js',
        array(),
        '1.0',
        true
    );
}
add_action('wp_enqueue_scripts', 'theme_enqueue_assets');
```

These functions help WordPress load assets in the correct place, avoid duplicates, and manage dependencies.


## 2. WordPress REST API

The WordPress REST API lets external applications access WordPress content through URL endpoints. Instead of reading directly from the WordPress database, an app can request data from WordPress and receive JSON responses.

For example, a request to:

`/wp-json/wp/v2/posts`

returns a list of blog posts from the WordPress site.

### Common Default Endpoints

WordPress exposes several REST API endpoints out of the box:

| Endpoint | Purpose |
|---|---|
| `/wp-json/wp/v2/posts` | Gets blog posts |
| `/wp-json/wp/v2/pages` | Gets pages |
| `/wp-json/wp/v2/categories` | Gets categories |
| `/wp-json/wp/v2/tags` | Gets tags |
| `/wp-json/wp/v2/media` | Gets uploaded media files |
| `/wp-json/wp/v2/users` | Gets users/authors |
| `/wp-json/wp/v2/comments` | Gets comments |
| `/wp-json/wp/v2/search` | Gets search results |
| `/wp-json/wp/v2/menu-items` | Gets navigation menu items |

### Data Shape

Most REST API responses return JSON objects with fields such as:

- `id`
- `date`
- `slug`
- `status`
- `type`
- `link`
- `title`
- `content`
- `excerpt`
- `author`
- `featured_media`
- `categories`
- `tags`

For example, a post object may include:

```json
{
  "id": 1,
  "slug": "hello-world",
  "title": {
    "rendered": "Hello World"
  },
  "content": {
    "rendered": "<p>This is the post content.</p>"
  }
}
```

## 3. WordPress → Next.js Mapping

This section explains how common WordPress theme concepts can map to equivalent Next.js concepts.

| WordPress Concept | Next.js Equivalent | Notes |
|---|---|---|
| `index.php` | `pages/index.jsx` or `app/page.jsx` | Main fallback/homepage template |
| `single.php` | `pages/posts/[slug].jsx` or `app/posts/[slug]/page.jsx` | Dynamic route for individual blog posts |
| `page.php` | `pages/[slug].jsx` or `app/[slug]/page.jsx` | Dynamic route for normal WordPress pages |
| `archive.php` | `pages/archive.jsx` or dynamic archive routes | Used for lists of posts |
| `category.php` | `pages/category/[slug].jsx` | Dynamic route for category pages |
| `search.php` | `pages/search.jsx` | Search results page |
| `404.php` | `pages/404.jsx` or `app/not-found.jsx` | Not found page |
| `header.php` | `components/Header.jsx` | Shared header component |
| `footer.php` | `components/Footer.jsx` | Shared footer component |
| `sidebar.php` | `components/Sidebar.jsx` | Shared sidebar/widget area component |

### Template Tags to REST API Data

WordPress template tags display dynamic data from WordPress. In Next.js, this data would usually come from the WordPress REST API.

| WordPress Template Tag | REST API Field / Next.js Data |
|---|---|
| `the_title()` | `post.title.rendered` |
| `the_content()` | `post.content.rendered` |
| `the_excerpt()` | `post.excerpt.rendered` |
| `get_permalink()` | `post.link` or generated route using `post.slug` |
| `the_post_thumbnail()` | `post.featured_media` and media endpoint data |
| `the_author()` | `post.author` and user endpoint data |
| `the_date()` | `post.date` |

### WordPress Loops to JavaScript `.map()`

In WordPress, the Loop goes through posts and displays each one.

In Next.js, this usually becomes a JavaScript `.map()` over an array of posts.

```jsx
{posts.map((post) => (
  <article key={post.id}>
    <h2 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
    <div dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />
  </article>
))}
```

### Conditional Tags to Next.js Logic

WordPress conditional tags like `is_single()`, `is_page()`, and `is_archive()` check what type of page is being displayed.

In Next.js, this is usually handled through routing.

For example:

- `is_single()` maps to a post route like `/posts/[slug]`
- `is_page()` maps to a page route like `/[slug]`
- `is_archive()` maps to archive or category routes
- `is_404()` maps to a Next.js not found page

### Assets

WordPress uses enqueue functions to load styles and scripts.

| WordPress | Next.js |
|---|---|
| `wp_enqueue_style()` | CSS imports, global styles, or component styles |
| `wp_enqueue_script()` | `next/script` or JavaScript imports |

### Menus

WordPress menus are usually displayed with `wp_nav_menu()`.

In Next.js, menus can become a navigation component that receives menu data from the WordPress REST API or a plugin-provided menu endpoint.

Example:

```jsx
<nav>
  {menuItems.map((item) => (
    <a href={item.url} key={item.id}>
      {item.title.rendered}
    </a>
  ))}
</nav>
```


## 4. Next.js Output Structure

This section defines what the generated Next.js project should look like after converting a WordPress theme.

### Project Folder Structure

A generated Next.js project may look like this:

```text
converted-site/
  pages/
    index.jsx
    [slug].jsx
    posts/
      [slug].jsx
    category/
      [slug].jsx
    404.jsx

  components/
    Header.jsx
    Footer.jsx
    Sidebar.jsx
    PostCard.jsx

  lib/
    api.js

  public/
    images/

  styles/
    globals.css

  package.json
  next.config.js
```

### Key Folders

| Folder/File | Purpose |
|---|---|
| `pages/` | Stores route-based pages in Next.js |
| `components/` | Stores reusable UI pieces like Header, Footer, and Sidebar |
| `lib/api.js` | Stores helper functions for fetching data from the WordPress REST API |
| `public/` | Stores static assets like images, icons, and fonts |
| `styles/` | Stores global CSS and converted theme styles |
| `next.config.js` | Stores Next.js configuration |

### API Helper

The generated project should include a reusable API helper for calling the WordPress REST API.

Example:

```js
const WP_API_BASE = process.env.NEXT_PUBLIC_WP_API_BASE;

export async function fetchAPI(endpoint) {
  const res = await fetch(`${WP_API_BASE}${endpoint}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${endpoint}`);
  }

  return res.json();
}
```

This keeps WordPress API calls organized instead of repeating fetch logic in every page.

### Routing

WordPress posts and pages usually map to dynamic Next.js routes.

Examples:

| WordPress Content | Next.js Route |
|---|---|
| Homepage | `pages/index.jsx` |
| Blog post | `pages/posts/[slug].jsx` |
| Normal page | `pages/[slug].jsx` |
| Category archive | `pages/category/[slug].jsx` |
| 404 page | `pages/404.jsx` |

### Rendering Strategy

Next.js can generate pages in different ways:

| Strategy | Use Case |
|---|---|
| `getStaticProps` | Best for content that does not change often |
| `getServerSideProps` | Best for content that must always be fresh |
| App Router async Server Components | Modern Next.js approach for server-side data fetching |

For a headless WordPress setup, static generation is useful for posts and pages because it improves performance. Server rendering may be better for search pages, frequently updated content, or user-specific/private content.


## 5. Edge Cases and Limitations

Some WordPress theme patterns are difficult to convert automatically because they rely on custom logic, plugins, or dynamic behavior that does not map cleanly to Next.js.

### Difficult Patterns to Convert

| WordPress Pattern | Why It Is Difficult |
|---|---|
| Page builders like Elementor or Divi | Layouts are often stored as plugin-specific data instead of normal theme templates |
| Heavy PHP logic in templates | Custom conditions, functions, and database queries may not have a direct Next.js equivalent |
| Custom database queries | The data may not be available through the standard WordPress REST API |
| Shortcodes | Shortcodes depend on WordPress/plugin logic to render correctly |
| Embedded PHP in CSS/JS | Dynamic CSS or JavaScript may need manual conversion |
| Plugin-generated content | Some plugins output content that is not visible from the theme files alone |

### Manual Review Required

The conversion output should flag anything that cannot be safely converted automatically.

Examples:

- Custom PHP functions
- Unknown template tags
- Shortcodes in post content
- Plugin-specific markup
- Custom database queries
- Missing REST API data
- Dynamic sidebar/widget content
- Page builder layouts

### Shortcodes

Shortcodes are small WordPress commands inside content, such as:

```text
[gallery]
[contact-form-7]
[custom_button]
```

Some shortcodes may be simple, but others depend on plugins. These should usually be flagged for manual review unless the converter knows how to handle them.

### Plugins

Plugins can add custom content, fields, menus, SEO data, forms, and page layouts. Some plugin output may be accessible through the REST API, but other plugin behavior may require custom handling.

Common plugin areas to check:

- ACF fields
- SEO metadata
- Contact forms
- Page builders
- Custom post types
- Menus
- Sliders/galleries

### Simple Summary

Not every WordPress theme can be fully converted automatically. Standard templates, styles, scripts, and simple content are easier to convert. Custom PHP logic, page builders, shortcodes, and plugin-specific behavior should be flagged for manual review.


## 6. Recommended Conversion Approach

The conversion engine should follow a structured process: scan the WordPress theme, understand what each file does, convert what can be safely automated, and flag anything that needs manual review.

### Step-by-Step Algorithm

1. **Scan the WordPress theme folder**
   - Detect important files such as `index.php`, `header.php`, `footer.php`, `single.php`, `page.php`, `archive.php`, `functions.php`, `style.css`, `theme.json`, and asset folders.
   - Identify reusable folders such as `template-parts/`, `assets/`, `css/`, `js/`, and `images/`.

2. **Identify template roles**
   - Use WordPress template hierarchy rules to understand what each template file is responsible for.
   - For example:
     - `single.php` → single blog post page
     - `page.php` → regular WordPress page
     - `archive.php` → archive/list page
     - `index.php` → fallback template

3. **Parse PHP template files**
   - Extract static HTML.
   - Detect WordPress template tags such as `the_title()`, `the_content()`, and `get_permalink()`.
   - Detect WordPress Loops using `have_posts()` and `the_post()`.
   - Detect includes such as `get_header()`, `get_footer()`, and `get_sidebar()`.
   - Detect conditional tags such as `is_single()`, `is_page()`, and `is_archive()`.

4. **Convert shared template files into React components**
   - `header.php` → `components/Header.jsx`
   - `footer.php` → `components/Footer.jsx`
   - `sidebar.php` → `components/Sidebar.jsx`
   - `template-parts/` → reusable components such as `PostCard.jsx`

5. **Map WordPress templates to Next.js routes**
   - `index.php` → `pages/index.jsx`
   - `single.php` → `pages/posts/[slug].jsx`
   - `page.php` → `pages/[slug].jsx`
   - `category.php` → `pages/category/[slug].jsx`
   - `search.php` → `pages/search.jsx`
   - `404.php` → `pages/404.jsx`

6. **Map WordPress template tags to REST API data**
   - `the_title()` → `post.title.rendered`
   - `the_content()` → `post.content.rendered`
   - `the_excerpt()` → `post.excerpt.rendered`
   - `get_permalink()` → `post.link` or route generated from `post.slug`
   - `the_post_thumbnail()` → `post.featured_media`

7. **Convert WordPress Loops into JavaScript rendering**
   - WordPress Loops should become JavaScript `.map()` patterns over fetched data.

   ```jsx
   {posts.map((post) => (
     <article key={post.id}>
       <h2>{post.title.rendered}</h2>
     </article>
   ))}
   ```

8. **Convert assets**
   - CSS from `style.css` or enqueued styles should move into `styles/` or global CSS imports.
   - JavaScript from `wp_enqueue_script()` should become JavaScript imports or `next/script`.
   - Images, fonts, and icons should move into `public/`.

9. **Generate API helper functions**
   - Create a shared file such as `lib/api.js` for WordPress REST API requests.

   ```js
   const WP_API_BASE = process.env.NEXT_PUBLIC_WP_API_BASE;

   export async function fetchAPI(endpoint) {
     const res = await fetch(`${WP_API_BASE}${endpoint}`);

     if (!res.ok) {
       throw new Error(`Failed to fetch ${endpoint}`);
     }

     return res.json();
   }
   ```

10. **Generate the Next.js project structure**
   - Create folders such as `pages/`, `components/`, `lib/`, `public/`, and `styles/`.
   - Generate route files, reusable components, API helpers, copied assets, and converted styles.

11. **Create a conversion report**
   - List which templates were converted.
   - List which components were generated.
   - List which assets were copied.
   - List which items need manual review.

### What Can Be Automated

The following parts can usually be converted automatically:

- Standard template files such as `index.php`, `single.php`, `page.php`, `archive.php`, `search.php`, and `404.php`
- Basic HTML structure inside templates
- Common template tags such as `the_title()`, `the_content()`, and `get_permalink()`
- Basic WordPress Loops
- `header.php`, `footer.php`, and `sidebar.php`
- CSS and JavaScript files loaded through `wp_enqueue_style()` and `wp_enqueue_script()`
- Static assets such as images, fonts, and icons
- Basic dynamic routes for posts, pages, and categories

### What Should Produce a TODO Comment

Some WordPress logic should be flagged instead of automatically converted.

Examples:

- Custom PHP functions
- Custom database queries
- Unknown template tags
- Plugin-specific output
- Page builder layouts such as Elementor or Divi
- Shortcodes such as `[contact-form-7]` or `[gallery]`
- Dynamic widgets
- Embedded PHP inside CSS or JavaScript files
- REST API data that is missing or unavailable

Example TODO output:

```jsx
{/* TODO: Manual review required for custom PHP function: get_custom_banner() */}
```

### Helpful NPM Libraries

Possible libraries for building the converter:

| Library | Purpose |
|---|---|
| `php-parser` | Parses PHP code into an AST so the engine can inspect template files |
| `htmlparser2` | Parses HTML structure inside templates |
| `cheerio` | Useful for HTML traversal and manipulation |
| `postcss` | Parses and transforms CSS |
| `@babel/parser` | Parses JavaScript/JSX if generated code needs further processing |
| `prettier` | Formats generated Next.js files |
| `fs-extra` | Helps with reading, writing, and copying project files |

### Simple Summary

The conversion engine should:

1. Scan the WordPress theme.
2. Parse template files.
3. Extract HTML, PHP tags, loops, assets, and includes.
4. Convert standard patterns into Next.js routes and components.
5. Fetch dynamic content through the WordPress REST API.
6. Copy assets into the generated project.
7. Add TODO comments for anything unsafe or unsupported.
8. Output a complete Next.js project plus a conversion report.


## 7. WordPress Template Files to Next.js Equivalents

| WordPress Template File | Purpose in WordPress | Next.js Equivalent | Conversion Notes |
|---|---|---|---|
| `index.php` | Default fallback template for the site. Used when no more specific template exists. | `app/page.tsx` or fallback route files | Can become the homepage or a generic fallback layout depending on the theme. |
| `front-page.php` | Template for the site’s front page/homepage. | `app/page.tsx` | Highest priority for the homepage if it exists. |
| `home.php` | Template for the blog posts index page. | `app/blog/page.tsx` | Used for listing posts. Should fetch posts from `/wp/v2/posts`. |
| `single.php` | Template for an individual blog post. | `app/blog/[slug]/page.tsx` | Use post `slug` from the REST API to generate dynamic post pages. |
| `page.php` | Template for a static WordPress page. | `app/[slug]/page.tsx` | Used for pages like About, Contact, Services, etc. |
| `archive.php` | Template for archive pages such as date, category, tag, or author archives. | `app/archive/page.tsx` or specific archive routes | May need to split into category, tag, author, and date routes. |
| `category.php` | Template for category archive pages. | `app/category/[slug]/page.tsx` | Fetch posts by category from the REST API. |
| `tag.php` | Template for tag archive pages. | `app/tag/[slug]/page.tsx` | Fetch posts by tag from the REST API. |
| `author.php` | Template for author archive pages. | `app/author/[slug]/page.tsx` | Fetch posts by author ID or slug. |
| `date.php` | Template for date-based archives. | `app/archive/[year]/page.tsx` or similar | Usually lower priority; may need TODO handling. |
| `search.php` | Template for search results. | `app/search/page.tsx` | Can map to a search page that reads query params. |
| `404.php` | Template for not found pages. | `app/not-found.tsx` | Direct Next.js equivalent. |
| `header.php` | Reusable site header. | `components/Header.tsx` | Usually contains `<head>`, logo, navigation, opening layout markup. |
| `footer.php` | Reusable site footer. | `components/Footer.tsx` | Usually contains footer widgets, copyright, closing layout markup. |
| `sidebar.php` | Reusable sidebar/widget area. | `components/Sidebar.tsx` | Widget content may need TODO comments if dynamic. |
| `comments.php` | Comment display and comment form template. | `components/Comments.tsx` | May need manual handling unless comments are supported in the converted site. |
| `template-parts/*.php` | Reusable partial templates. | `components/*.tsx` | Good candidates for reusable React components. |
| `functions.php` | Theme setup file for menus, assets, sidebars, theme features, and helper imports. | No direct page equivalent | Used by the converter to discover assets, menus, sidebars, and theme configuration. |
| `style.css` | Main stylesheet and theme metadata. | `app/globals.css` or imported CSS file | CSS can be copied, imported, or converted depending on the target styling approach. |



## 8. Common WordPress Template Tags to WP REST API Equivalents

| WP Template Tag | What It Outputs in WordPress | REST API Equivalent | Next.js Example |
|---|---|---|---|
| `the_title()` | Current post/page title | `post.title.rendered` or `page.title.rendered` | `<h1 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />` |
| `get_the_title()` | Returns title as a string | `post.title.rendered` | `const title = post.title.rendered;` |
| `the_content()` | Main post/page content | `post.content.rendered` | `<div dangerouslySetInnerHTML={{ __html: post.content.rendered }} />` |
| `get_the_content()` | Returns content as a string | `post.content.rendered` | `const content = post.content.rendered;` |
| `the_excerpt()` | Post excerpt/summary | `post.excerpt.rendered` | `<div dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />` |
| `get_the_excerpt()` | Returns excerpt as a string | `post.excerpt.rendered` | `const excerpt = post.excerpt.rendered;` |
| `the_permalink()` | Current post/page URL | `post.link` | `<a href={post.link}>Read more</a>` |
| `get_permalink()` | Returns post/page URL | `post.link` | `const url = post.link;` |
| `the_ID()` | Current post/page ID | `post.id` | `<div data-post-id={post.id}>...</div>` |
| `get_the_ID()` | Returns post/page ID | `post.id` | `const id = post.id;` |
| `the_date()` | Post publish date | `post.date` | `<time>{new Date(post.date).toLocaleDateString()}</time>` |
| `get_the_date()` | Returns publish date | `post.date` | `const date = new Date(post.date);` |
| `the_modified_date()` | Last modified date | `post.modified` | `<time>{new Date(post.modified).toLocaleDateString()}</time>` |
| `the_author()` | Author display name | Need `/wp/v2/users/{id}` or `_embed` | `post._embedded.author[0].name` |
| `get_the_author()` | Returns author name | Need `/wp/v2/users/{id}` or `_embed` | `const author = post._embedded.author?.[0]?.name;` |
| `the_post_thumbnail()` | Featured image HTML | `post.featured_media` + `/wp/v2/media/{id}` | `<img src={media.source_url} alt={media.alt_text} />` |
| `get_the_post_thumbnail_url()` | Featured image URL | `/wp/v2/media/{featured_media}.source_url` | `const imageUrl = media.source_url;` |
| `the_category()` | Post categories | `post.categories` + `/wp/v2/categories` | `post.categories.map(id => ...)` |
| `the_tags()` | Post tags | `post.tags` + `/wp/v2/tags` | `post.tags.map(id => ...)` |
| `comments_number()` | Number of comments | `/wp/v2/comments?post={post.id}` | `const comments = await fetchComments(post.id);` |


## 9. Mapping WordPress Loops and Conditionals to JavaScript/React

### WordPress Loop to React

| WordPress | React / Next.js |
|---|---|
| `if ( have_posts() )` | `if (posts.length > 0)` |
| `while ( have_posts() )` | `posts.map(...)` |
| `the_post()` | Current `post` object inside `.map()` |
| `the_title()` | `post.title.rendered` |
| `the_content()` | `post.content.rendered` |
| `the_excerpt()` | `post.excerpt.rendered` |
| `the_permalink()` | `/blog/${post.slug}` or `post.link` |

### WordPress Example

~~~php
<?php if ( have_posts() ) : ?>
  <?php while ( have_posts() ) : the_post(); ?>
    <article>
      <h2><?php the_title(); ?></h2>
      <?php the_excerpt(); ?>
      <a href="<?php the_permalink(); ?>">Read more</a>
    </article>
  <?php endwhile; ?>
<?php else : ?>
  <p>No posts found.</p>
<?php endif; ?>
~~~

### React / Next.js Equivalent

~~~tsx
export default function PostsList({ posts }) {
  if (!posts || posts.length === 0) {
    return <p>No posts found.</p>;
  }

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />

          <div dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />

          <a href={`/blog/${post.slug}`}>Read more</a>
        </article>
      ))}
    </div>
  );
}
~~~

### WordPress Conditionals to Next.js

| WordPress Conditional | Meaning | Next.js Equivalent |
|---|---|---|
| `is_front_page()` | Front page | `app/page.tsx` |
| `is_home()` | Blog index | `app/blog/page.tsx` |
| `is_single()` | Single blog post | `app/blog/[slug]/page.tsx` |
| `is_page()` | Static page | `app/[slug]/page.tsx` |
| `is_archive()` | Archive page | `app/archive/page.tsx` |
| `is_category()` | Category archive | `app/category/[slug]/page.tsx` |
| `is_tag()` | Tag archive | `app/tag/[slug]/page.tsx` |
| `is_author()` | Author archive | `app/author/[slug]/page.tsx` |
| `is_search()` | Search page | `app/search/page.tsx` |
| `is_404()` | Not found page | `app/not-found.tsx` |
| `has_post_thumbnail()` | Checks for featured image | `if (post.featured_media)` |
| `comments_open()` | Checks if comments are open | `if (post.comment_status === "open")` |

### Converter Takeaway

WordPress loops usually become React `.map()` rendering.

WordPress conditionals usually become Next.js route files instead of large `if/else` blocks.

Examples:

- `have_posts()` + `while` becomes `posts.map(...)`
- `is_single()` becomes `app/blog/[slug]/page.tsx`
- `is_page()` becomes `app/[slug]/page.tsx`
- `is_404()` becomes `app/not-found.tsx`
- `has_post_thumbnail()` becomes `if (post.featured_media)`


## 10. WP Menus via REST API

WordPress menus can be inspected through REST API endpoints under `/wp/v2`.

Main menu-related endpoints:

| Endpoint | Purpose |
|---|---|
| `/wp/v2/menus` | Lists registered navigation menus |
| `/wp/v2/menus/{id}` | Gets one specific menu |
| `/wp/v2/menu-items` | Lists individual menu items |
| `/wp/v2/menu-items?menus={id}` | Lists menu items for a specific menu |
| `/wp/v2/menu-locations` | Lists theme menu locations |
| `/wp/v2/menu-locations/{location}` | Gets one specific menu location |

WordPress documentation defines `/wp/v2/menus` for nav menus, `/wp/v2/menu-items` for nav menu items, and `/wp/v2/menu-locations` for menu locations. Menu locations connect theme-defined areas like `primary` or `footer` to an actual assigned menu. 

### Commands Used

List all menus:

~~~bash
curl http://wordpress-theme-test.local/wp-json/wp/v2/menus | jq
~~~

List all menu items:

~~~bash
curl http://wordpress-theme-test.local/wp-json/wp/v2/menu-items | jq
~~~

List all menu locations:

~~~bash
curl http://wordpress-theme-test.local/wp-json/wp/v2/menu-locations | jq
~~~

Get menu items for a specific menu:

~~~bash
curl "http://wordpress-theme-test.local/wp-json/wp/v2/menu-items?menus=MENU_ID" | jq
~~~

### Menu Response Shape

A menu response commonly includes:

| Field | Meaning |
|---|---|
| `id` | Menu ID |
| `description` | Menu description |
| `name` | Menu name |
| `slug` | Menu slug |
| `meta` | Extra metadata |
| `_links` | REST API links |

Example shape:

~~~json
{
  "id": 2,
  "description": "",
  "name": "Main Menu",
  "slug": "main-menu",
  "meta": [],
  "_links": {}
}
~~~

### Menu Item Response Shape

A menu item response commonly includes:

| Field | Meaning |
|---|---|
| `id` | Menu item ID |
| `title.rendered` | Menu item label |
| `url` | Link URL |
| `type` | Type of menu item |
| `object` | Linked object type, such as `page` or `custom` |
| `object_id` | ID of the linked WordPress object |
| `menus` | Menu ID this item belongs to |
| `parent` | Parent menu item ID |
| `menu_order` | Order of the item |
| `target` | Link target, such as `_blank` |
| `classes` | CSS classes |
| `attr_title` | Optional title attribute |
| `description` | Optional description |
| `_links` | REST API links |

Example shape:

~~~json
{
  "id": 10,
  "title": {
    "rendered": "Sample Page"
  },
  "url": "http://wordpress-theme-test.local/sample-page/",
  "type": "post_type",
  "object": "page",
  "object_id": 2,
  "menus": 2,
  "parent": 0,
  "menu_order": 1,
  "target": "",
  "classes": [],
  "attr_title": "",
  "description": "",
  "_links": {}
}
~~~

### Menu Location Response Shape

A menu location response commonly includes:

| Field | Meaning |
|---|---|
| `name` | Location name, such as `primary` |
| `description` | Human-readable location description |
| `menu` | Assigned menu ID |
| `_links` | REST API links |

Example shape:

~~~json
{
  "name": "primary",
  "description": "Primary menu",
  "menu": 2,
  "_links": {}
}
~~~

### Converter Takeaway

For a WordPress to Next.js converter, menus should be handled in this order:

1. Fetch menu locations from `/wp/v2/menu-locations`.
2. Find the assigned menu ID for locations like `primary` or `footer`.
3. Fetch menu items from `/wp/v2/menu-items?menus={id}`.
4. Sort menu items by `menu_order`.
5. Convert each menu item into a React navigation link.
6. Use `parent` to rebuild nested dropdown menus if needed.

A simple WordPress menu can become a React component like:

~~~tsx
export default function Navigation({ items }) {
  return (
    <nav>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.url}>
              {item.title.rendered}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
~~~

Menus are important because `functions.php` may register menu locations with `register_nav_menus()`, but the REST API provides the actual menu data assigned in WordPress admin.


## 11. PHP Parser Research

### Goal

Test whether the `php-parser` npm package can parse a sample WordPress `.php` template file.

### Package

`php-parser` is a Node.js package that parses PHP code and converts it into an AST, which can help the converter inspect WordPress theme templates in a structured way. :contentReference[oaicite:0]{index=0}

### Install

~~~bash
npm install php-parser
~~~

### Sample PHP Template

Create:

`test/sample-template.php`

~~~php
<?php get_header(); ?>

<?php if ( have_posts() ) : ?>
  <?php while ( have_posts() ) : the_post(); ?>
    <article>
      <h1><?php the_title(); ?></h1>
      <div><?php the_content(); ?></div>
    </article>
  <?php endwhile; ?>
<?php else : ?>
  <p>No posts found.</p>
<?php endif; ?>

<?php get_footer(); ?>
~~~

### Parser Test Script

Create:

`test/parse-php-template.js`

~~~js
const fs = require("fs");
const parser = require("php-parser");

const engine = new parser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

const code = fs.readFileSync("test/sample-template.php", "utf8");
const ast = engine.parseCode(code);

console.log(JSON.stringify(ast, null, 2));
~~~

### Run

~~~bash
node test/parse-php-template.js
~~~

### Expected Result

The script should output a large JSON AST. The converter can inspect that AST to detect WordPress template functions such as:

| WordPress Function | Meaning | Possible Next.js Output |
|---|---|---|
| `get_header()` | Loads the theme header | `<Header />` |
| `get_footer()` | Loads the theme footer | `<Footer />` |
| `have_posts()` | Checks if posts exist | `posts.length > 0` |
| `the_post()` | Sets current post in loop | Current `post` in `.map()` |
| `the_title()` | Outputs post title | `post.title.rendered` |
| `the_content()` | Outputs post content | `post.content.rendered` |

### Converter Takeaway

`php-parser` can be used as the first parsing layer for the converter. It can parse WordPress PHP templates into an AST, then the converter can walk the AST and map known WordPress functions to React/Next.js output.

## Recommended Next.js Output Structure for WordPress Templates

A WordPress theme should be converted into a Next.js App Router project where page-level templates become route files and reusable PHP files become React components.

## 12. Recommended Output Structure

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
├── tag/
│   └── [slug]/
│       └── page.tsx
├── author/
│   └── [slug]/
│       └── page.tsx
└── search/
    └── page.tsx

components/
├── Header.tsx
├── Footer.tsx
├── Sidebar.tsx
├── Comments.tsx
└── template-parts/
    ├── Content.tsx
    ├── ContentPage.tsx
    └── ContentSingle.tsx

lib/
├── wordpress.ts
└── api.ts

public/
└── wp-assets/
~~~

### WordPress Template to Next.js File Mapping

| WordPress Template | Purpose | Next.js Output File |
|---|---|---|
| `front-page.php` | Site homepage | `app/page.tsx` |
| `home.php` | Blog posts index | `app/blog/page.tsx` |
| `index.php` | Default fallback template | `app/page.tsx` or fallback route |
| `single.php` | Single blog post | `app/blog/[slug]/page.tsx` |
| `page.php` | Static WordPress page | `app/[slug]/page.tsx` |
| `archive.php` | General archive page | `app/archive/page.tsx` |
| `category.php` | Category archive | `app/category/[slug]/page.tsx` |
| `tag.php` | Tag archive | `app/tag/[slug]/page.tsx` |
| `author.php` | Author archive | `app/author/[slug]/page.tsx` |
| `search.php` | Search results page | `app/search/page.tsx` |
| `404.php` | Not found page | `app/not-found.tsx` |
| `header.php` | Site header | `components/Header.tsx` |
| `footer.php` | Site footer | `components/Footer.tsx` |
| `sidebar.php` | Sidebar/widget area | `components/Sidebar.tsx` |
| `comments.php` | Comments section | `components/Comments.tsx` |
| `template-parts/*.php` | Reusable template partials | `components/template-parts/*.tsx` |
| `functions.php` | Theme setup, menus, assets, helpers | Used for analysis only |
| `style.css` | Theme styles | `app/globals.css` or imported CSS file |

### Converter Takeaway

The converter should separate WordPress files into three groups:

1. **Routes**
   - Templates like `single.php`, `page.php`, `home.php`, and `archive.php`
   - These become files inside the Next.js `app/` directory.

2. **Components**
   - Files like `header.php`, `footer.php`, `sidebar.php`, and `template-parts/*.php`
   - These become reusable React components.

3. **Configuration and Assets**
   - Files like `functions.php`, `style.css`, JavaScript files, and images
   - These are used to discover menus, scripts, styles, and assets for the generated Next.js project.