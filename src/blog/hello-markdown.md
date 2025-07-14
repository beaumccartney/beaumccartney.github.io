# Hello Markdown!

<publish-date>2025-06-11</publish-date>

A sample page to test some of the markdown features. Don't take any of the code
or math seriously.

<hr/>

- *italic*
- ~~strikethrough~~
    1. order
    1. the
    1. things

### h3
#### h4
##### h5

## Code

Some c code:<fn>here's a footnote with a [link](https://github.com/beaumccartney/root_c/blob/main/metagen/metagen_main.c) to it</fn>

```c
Arena *iter_arena = arena_default(),
      *work_arena = arena_default();

// <project root>/build/.. i.e. project root
String8 project_root = str8_chop_last_slash(g_os_state.process_info.exe_folder);
printf("searching '%.*s'\n\n", str8_varg(project_root));
OS_FileIter *iter = os_file_iter_begin(iter_arena, project_root, ...);
```

Some python code:

```python
if check_and_remove(options, "release"):
    command += ("-O2", "-DBUILD_DEBUG=0")
    print("[release mode]")
else:
    options.add("debug")
```

## Math

Math rendering courtesy of [katex](katex.org)<fn>offline rendering is done with micromark's math extension</fn>

Statistical variance can be computed like so: $v = \sum_{i=1}^{n} (x_i - \mu)^2$

Standard deviation is simply the square root of the variance:

$$
\sigma = \sqrt{\sum_{i=1}^{n} (x_i - \mu)^2}
$$
