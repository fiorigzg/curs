"""CLI for self-hosted user management.

Usage inside container:
    docker compose exec api python -m curs_api.cli users create --email ... --password ...
    docker compose exec api python -m curs_api.cli users list
    docker compose exec api python -m curs_api.cli users set-password --email ...
    docker compose exec api python -m curs_api.cli users delete --email ...
"""
import asyncio
import getpass
import secrets
import string
import sys
from typing import List, Optional

import typer
from tortoise import Tortoise

from curs_api.auth.password import hash_password
from curs_api.db import TORTOISE_ORM
from curs_api.models import Portfolio, PortfolioMetric, User

app = typer.Typer(no_args_is_help=True, add_completion=False)
users_app = typer.Typer(no_args_is_help=True, add_completion=False)
analytics_app = typer.Typer(no_args_is_help=True, add_completion=False)
app.add_typer(users_app, name="users", help="User management")
app.add_typer(analytics_app, name="analytics", help="Пересчёт риск-аналитики")


def _run(coro):
    async def _wrap():
        await Tortoise.init(config=TORTOISE_ORM)
        try:
            return await coro
        finally:
            await Tortoise.close_connections()

    return asyncio.run(_wrap())


def _prompt_password() -> str:
    p1 = getpass.getpass("Password: ")
    p2 = getpass.getpass("Confirm: ")
    if p1 != p2:
        typer.echo("Passwords do not match", err=True)
        raise typer.Exit(1)
    if len(p1) < 8:
        typer.echo("Password must be at least 8 characters", err=True)
        raise typer.Exit(1)
    return p1


def _gen_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@users_app.command("create")
def create_user(
    email: str = typer.Option(..., "--email"),
    password: Optional[str] = typer.Option(None, "--password", help="Skip prompt"),
    name: Optional[str] = typer.Option(None, "--name"),
    generate: bool = typer.Option(False, "--generate", help="Generate random password"),
):
    """Create a new user."""
    email = email.strip().lower()

    if generate:
        password = _gen_password()
        typer.echo(f"Generated password: {password}")
    elif password is None:
        password = _prompt_password()

    async def _do():
        if await User.exists(email=email):
            typer.echo(f"User {email!r} already exists", err=True)
            raise typer.Exit(1)
        user = await User.create(
            email=email,
            password_hash=hash_password(password),
            display_name=name or email.split("@")[0],
        )
        typer.echo(f"Created user {user.email} (id={user.id})")

    _run(_do())


@users_app.command("list")
def list_users():
    """List all users."""

    async def _do():
        users = await User.all().order_by("created_at")
        if not users:
            typer.echo("(no users)")
            return
        for u in users:
            active = "active" if u.is_active else "DISABLED"
            typer.echo(f"{u.id}  {u.email:40}  {u.display_name:30}  {active}")

    _run(_do())


@users_app.command("set-password")
def set_password(
    email: str = typer.Option(..., "--email"),
    password: Optional[str] = typer.Option(None, "--password"),
):
    """Reset user password."""
    email = email.strip().lower()
    if password is None:
        password = _prompt_password()

    async def _do():
        user = await User.get_or_none(email=email)
        if not user:
            typer.echo(f"User {email!r} not found", err=True)
            raise typer.Exit(1)
        user.password_hash = hash_password(password)
        await user.save(update_fields=["password_hash", "updated_at"])
        typer.echo(f"Password updated for {email}")

    _run(_do())


@users_app.command("delete")
def delete_user(
    email: str = typer.Option(..., "--email"),
    yes: bool = typer.Option(False, "--yes", help="Skip confirmation"),
):
    """Delete a user (cascades to portfolios, etc.)."""
    email = email.strip().lower()
    if not yes:
        confirm = input(f"Delete user {email}? [y/N] ")
        if confirm.strip().lower() != "y":
            typer.echo("Aborted")
            raise typer.Exit(0)

    async def _do():
        user = await User.get_or_none(email=email)
        if not user:
            typer.echo(f"User {email!r} not found", err=True)
            raise typer.Exit(1)
        await user.delete()
        typer.echo(f"Deleted {email}")

    _run(_do())


@users_app.command("disable")
def disable_user(email: str = typer.Option(..., "--email")):
    """Disable a user without deleting their data."""
    email = email.strip().lower()

    async def _do():
        user = await User.get_or_none(email=email)
        if not user:
            typer.echo(f"User {email!r} not found", err=True)
            raise typer.Exit(1)
        user.is_active = False
        await user.save(update_fields=["is_active", "updated_at"])
        typer.echo(f"Disabled {email}")

    _run(_do())


@analytics_app.command("recalc")
def analytics_recalc(
    portfolio: str = typer.Option(..., "--portfolio", help="UUID портфеля"),
    section: Optional[List[str]] = typer.Option(
        None, "--section", help="Секция (можно повторять); пусто — все"
    ),
    market_shock: Optional[float] = typer.Option(None, "--market-shock", help="Доп. сценарий, напр. -0.15"),
    simulations: Optional[int] = typer.Option(None, "--simulations", help="Число путей Monte Carlo"),
    horizon: Optional[int] = typer.Option(None, "--horizon", help="Горизонт MC (торговых дней)"),
    wait: bool = typer.Option(False, "--wait", help="Ждать завершения, печатая прогресс"),
):
    """Поставить пересчёт аналитики портфеля в очередь воркера.

    Требует запущенный analytics-воркер (он в стеке docker compose). С --wait
    опрашивает статус задачи до завершения.
    """
    from curs_api.services import recalc_queue as q

    async def _do():
        pf = await Portfolio.get_or_none(id=portfolio)
        if not pf:
            typer.echo(f"Портфель {portfolio!r} не найден", err=True)
            raise typer.Exit(1)
        unknown = [s for s in (section or []) if s not in q.SECTIONS]
        if unknown:
            typer.echo(f"Неизвестные секции: {', '.join(unknown)}", err=True)
            raise typer.Exit(1)
        params: dict = {}
        if market_shock is not None:
            params["marketShock"] = market_shock
        if simulations is not None:
            params["simulations"] = simulations
        if horizon is not None:
            params["horizon"] = horizon
        job, created = await q.enqueue_recalc(portfolio, section, params)
        typer.echo(
            f"{'Поставлена' if created else 'Уже выполняется'} задача {job['id']} "
            f"(секции: {', '.join(job['sections'])})"
        )
        if wait:
            last = -1
            while True:
                cur = await q.get_job(job["id"])
                if not cur:
                    typer.echo("Задача исчезла из очереди", err=True)
                    raise typer.Exit(1)
                if cur["progress"] != last:
                    typer.echo(f"  {cur['status']}: {cur['progress']}% "
                               f"(готово: {', '.join(cur['doneSections']) or '—'})")
                    last = cur["progress"]
                if cur["status"] in ("done", "failed"):
                    if cur["status"] == "failed":
                        typer.echo(f"Ошибка: {cur.get('error')}", err=True)
                        raise typer.Exit(1)
                    typer.echo("Готово")
                    return
                await asyncio.sleep(1.0)

    _run(_do())


@analytics_app.command("show")
def analytics_show(
    portfolio: str = typer.Option(..., "--portfolio", help="UUID портфеля"),
    section: Optional[List[str]] = typer.Option(None, "--section", help="Фильтр по секции"),
):
    """Показать сохранённые секции аналитики портфеля и время их расчёта."""

    async def _do():
        qs = PortfolioMetric.filter(portfolio_id=portfolio)
        if section:
            qs = qs.filter(metric_key__in=section)
        rows = await qs.all()
        if not rows:
            typer.echo("(нет рассчитанных метрик)")
            return
        for r in sorted(rows, key=lambda x: x.metric_key):
            insufficient = r.payload.get("insufficientData") if isinstance(r.payload, dict) else None
            flag = "  ⚠ insufficient_data" if insufficient else ""
            typer.echo(f"{r.metric_key:14}  {r.computed_at.isoformat()}{flag}")

    _run(_do())


if __name__ == "__main__":
    app()
