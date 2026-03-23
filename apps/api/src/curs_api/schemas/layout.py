from curs_api.schemas.common import CamelModel


class LayoutBody(CamelModel):
    widget_ids: list[str]
