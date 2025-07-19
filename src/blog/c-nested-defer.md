# Arbitrarily Nestable Defer Statement in C

<publish-date>2025-07-18</publish-date>

Defer loops are a common C macro trick:

```c
#define DEFER_LOOP(begin, end) for (int8_t _deferloop_latch_ = ((begin), 0); !_deferloop_latch_; _deferloop_latch_ = 1, (end))

// e.g.
DEFER_LOOP(mutex_lock(&mtx), mutex_unlock(&mtx))
{
    // critical section
}
```

It's simply a loop whose body is run only once, that takes advantage of the
[somewhat bizarre
semantics](https://en.wikipedia.org/wiki/Comma_operator#Syntax) of C's comma
operator to execute `begin` before the loop body, and `end` after.

It's plausible that you may want to nest defer loops, especially if you've
built other useful utilities on top of them:

```c
#define MUTEX_SCOPE(mtx) DEFER_LOOP(mutex_lock(&(mtx)), mutex_unlock(&(mtx)))
#define PROFILE_SCOPE() DEFER_LOOP(profile_begin_section(), profile_end_section())

MUTEX_SCOPE(mtx)
{
    // critical section

    PROFILE_SCOPE()
    {
        // profiled section
    }

    // ...
}
```

When this is expanded, both defer loops will declare the loop counter variable,
and the inner variable will shadow the outer variable. Depending on your
compiler and build process, this may be a warning or error.

If shadowing isn't a problem in your context, then this is fine. However, you
may want to use this construct in multiple places, libraries, etc. In these
environments, making consumers have to deal with warnings from your code adds
friction,<fn>Turning warnings on and off for given sections of c code is
    different for each compiler and a [huge
    hassle](https://github.com/beaumccartney/root_c/blob/db39ac541d2700a7ba5352fc76049d57defc943f/layers/base/base_strings.c#L1-L16).</fn>
and can possibly cause more serious problems.<fn>e.g. turning off warnings when
    `#include`-ing your code, and forgetting to turn them back on again.</fn>

A fairly obvious approach to removing the shadowing problem is simply <span
    id="unique-ident-code">generating a unique identifier for the loop
    counter</span>, which can be done with the
[`__COUNTER__`](https://www.open-std.org/JTC1/sc22/wg14/www/docs/n3457.htm)
macro:

```c
#define GLUE_(A,B) A##B
#define GLUE(A,B) GLUE_(A,B)
#define UNIQUE_IDENT(ID) GLUE(ID, __COUNTER__)

#define DEFER_LOOP_(begin, end, latch) for(int8_t latch = ((begin), 0); !latch; latch = 1, (end))
#define DEFER_LOOP(begin, end)         DEFER_LOOP_((begin), (end), UNIQUE_IDENT(_deferloop_latch_))
```

Note that the `GLUE` macros are just a trick to generate an identifier by
concatenating the passed in strings.

Unfortunately, `__COUNTER__` isn't standardized, though it is [widely
supported](https://isocpp.org/files/papers/P3384R0.html#rationale-for-standardization).
If being non-standard isn't acceptable, then another approach is needed.

Enter the <span id="thread-local-latch-code">thread-local defer loop latch:</span>

```c
// NOTE: some variant of thread local is supported on each compiler, I just
// #define thread_local to whatever it is on a given compiler.
//
// There are standardized versions of thread_local, find out what works in the
// standard you're using if that's preferred.

_Thread_local int8_t _t_deferloop_latch_;
#define DEFER_LOOP(begin, end) for (_t_deferloop_latch_ = ((begin), 0); !_t_deferloop_latch_; _t_deferloop_latch_ = 1, (end))
```

This works because each loop writes to `_t_deferloop_latch_` *immediately
before the loop test*, meaning that any nested our outer loops cannot affect
the current loop's execution path.

I
[found](https://github.com/nicbarker/clay/blob/91c6d0577409908e4bfa1e6930e8f3cea82ec7f0/clay.h#L104-L141)
this trick in Nic Barker's excellent UI layout library,
[clay](https://www.nicbarker.com/clay).<fn>The `thread_local` touch is my own.
    To the best of my knowledge, clay isn't meant to be used from multiple
    threads.</fn>

There is have one caveat: the loop can't be entirely unrolled and ignored by an
optimizer. I think this is because reads/writes to a global/thread-local
variable cannot be ignored. With the usual approach, the loop latch is a local
variable who's entire lifetime and usage is easily visible to the compiler, so
the information that the loop can only ever run once (and therefore the loop
latch is redundant) is readily available.

Here's a comparison of the two approaches in
[godbolt](https://godbolt.org/z/MrMeGj381).

So what should you use? If the non-standard nature of `__COUNTER__` is
acceptable, use the [unique identifier](#unique-ident-code) approach. Else use
the [thread local latch](#thread-local-latch-code) approach.
