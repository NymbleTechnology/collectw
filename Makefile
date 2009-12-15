sources=$(wildcard *.c)
objects=$(patsubst %.c,%.o,$(sources))

LDFLAGS+=-lfcgi

collectw: $(objects)
	@gcc -o $@ $^ $(LDFLAGS)