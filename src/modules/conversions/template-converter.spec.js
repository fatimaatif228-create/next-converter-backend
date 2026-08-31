const { TemplateConverter } = require('./template-converter');

describe('TemplateConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new TemplateConverter();
  });

  it('replaces basic WordPress template tags with JSX equivalents', () => {
    const php = `
      <article>
        <h1><?php the_title(); ?></h1>
        <div><?php the_content(); ?></div>
        <a href="<?php the_permalink(); ?>">Read more</a>
        <p><?php the_date(); ?></p>
        <span><?php the_author(); ?></span>
      </article>
    `;

    const result = converter.convert(php, 'single.php');

    expect(result).toContain('export default function Single()');
    expect(result).toContain(
      '<h1 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />',
    );
    expect(result).toContain(
      '<div dangerouslySetInnerHTML={{ __html: post.content.rendered }} />',
    );
    expect(result).toContain('href={post.link}');
    expect(result).toContain('{new Date(post.date).toLocaleDateString()}');
    expect(result).toContain('{post._embedded?.author?.[0]?.name}');
    expect(result).not.toContain('<?php');
    expect(result).not.toContain('?>');
  });

  it('converts a basic WordPress loop into a posts.map pattern', () => {
    const php = `
      <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
        <h2><?php the_title(); ?></h2>
      <?php endwhile; endif; ?>
    `;

    const result = converter.convert(php, 'index.php');

    expect(result).toContain('posts.map(post => (');
    expect(result).toContain(
      '<h2 key={post.id} dangerouslySetInnerHTML={{ __html: post.title.rendered }} />',
    );
    expect(result).not.toContain('have_posts');
    expect(result).not.toContain('the_post');
  });

  it('replaces unrecognized PHP with a manual conversion TODO comment', () => {
    const php = `
      <section>
        <?php custom_theme_banner(); ?>
      </section>
    `;

    const result = converter.convert(php, 'front-page.php');

    expect(result).toContain('{/* TODO: manual conversion required */}');
    expect(result).not.toContain('custom_theme_banner');
    expect(result).not.toContain('<?php');
    expect(result).not.toContain('?>');
  });
});