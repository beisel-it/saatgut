FROM postgres:16-alpine

COPY docker/db/reconcile-entrypoint.sh /usr/local/bin/reconcile-entrypoint.sh
RUN chmod +x /usr/local/bin/reconcile-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/reconcile-entrypoint.sh"]
CMD ["postgres"]
